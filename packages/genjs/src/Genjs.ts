import IPackage from './IPackage';
import IGenerator from './IGenerator';
import FilesPlugin from './plugins/files';
import DirectoryRegistryPlugin from './plugins/directory-registry';
import IPlugin, {PluginConfig} from './IPlugin';
import {renderFile, jsStringify, copy, writeFile, populateData} from './utils';
import {PackageGroup} from './PackageGroup';
import ITemplate, {isTemplate} from './ITemplate';
import Template from './Template';
import IRegistry from "./IRegistry";
import {BaseRegistryConfig} from "./AbstractRegistry";
import PackageConfigEnhancer from "./configEnhancers/PackageConfigEnhancer";
import * as commonPredefinedTargets from "./targets";

const fs = require('fs');
const path = require('path');

export type GroupConfig = {
    name?: string,
    in?: string,
    dir?: string,
};

export type GeneratorConfig = {
    rootDir: string,
    vars?: any,
    locked?: string[],
    plugins?: (PluginConfig|string)[],
    groups?: {[key: string]: GroupConfig},
    [key: string]: any,
};

export type GenjsConfig = GeneratorConfig & {}

export class Genjs implements IGenerator {
    public readonly predefinedTargets: {[key: string]: any} = {};
    public readonly targets: {[key: string]: any} = {};
    public readonly registries: IRegistry[] = [];
    public readonly registryFactories: {[key: string]: (config: any) => IRegistry} = {};
    public readonly plugins: IPlugin[] = [];
    public readonly groups: {[key: string]: PackageGroup} = {};
    public readonly packagers: {[key: string]: (config: any) => IPackage} = {};
    public readonly vars: {[key: string]: any} = {};
    public readonly locked: {[key: string]: any} = {};
    public readonly rootDir: string
    protected readonly packageEventHooks = {};
    protected readonly groupEventHooks = {};
    protected readonly globalEventHooks = {};
    private readonly globalContext = {};
    constructor({rootDir, plugins = [], groups = {}, locked = [], vars = {}, ...extra}: GenjsConfig) {
        this.registerPredefinedTargets(commonPredefinedTargets);
        this.rootDir = rootDir;
        this.locked = {...locked.reduce((acc, k) => Object.assign(acc, {[k]: true}), {}), ...(vars.locked || {})};
        this.vars = {
            generator: 'genjs',
            license: 'MIT',
            date: new Date().toISOString(),
            rootDir: this.rootDir,
            defaultPackageType: 'files',
            ...vars,
            verbose: vars.verbose || process.env.GENJS_VERBOSE || 0,
        };
        groups = groups || {};
        if (!Object.keys(groups).length) {
            groups['packages'] = {};
        }
        if (extra.root) {
            !groups['root'] && (groups['root'] = {dir: '.'});
            if (extra.root.type) {
                extra.root = {'.': extra.root};
            }
        }
        if (extra.projects) {
            !groups['projects'] && (groups['projects'] = {dir: '.'});
        }
        this.groups = Object.entries(groups).reduce((acc, [k, v]) => {
            const {in: key = k, dir = k} = v;
            acc[k] = new PackageGroup(this, {name: k, packages: extra[key] || {}, dir});
            return acc;
        }, {});
        const requiredPackagers = Object.values(this.groups).reduce((acc, g) => {
            return g.getRequiredPackagers().reduce((acc2, p) => {
                acc2[p] = true;
                return acc;
            }, acc);
        }, {} as {[key: string]: boolean});
        const localPlugin = `${rootDir}/.genjs/.local`;
        try {
            const localPluginPath = fs.realpathSync(localPlugin);
            if (localPluginPath) plugins.push('./.genjs/.local');
        } catch (e) {
            // nothing to do, local plugin does not exist.
        }
        this.registerPlugin(new DirectoryRegistryPlugin());
        try {
            const localAssetsDir = fs.realpathSync(`${rootDir}/.genjs/.assets`);
            this.registerRegistry('directory', {path: localAssetsDir});
        } catch (e) {
            // nothing to do, local assets does not exist.
        }
        this.loadPlugins(plugins);
        this.registerPlugin(new FilesPlugin());
        const notListedRequiredPackagerNames = Object.keys(requiredPackagers).filter(p =>
            !Object.keys(this.packagers).find(pp => p === pp)
        );
        if (0 < notListedRequiredPackagerNames.length) {
            throw new Error(`Please update your GenJS plugins list to add plugin(s) that enable the following packager types:\n\n${notListedRequiredPackagerNames.map(x => `  - ${x}\n`).join('')}`)
        }
    }
    protected loadPlugins(plugins: any[]): void {
        plugins.forEach(p => {
            if ('string' === typeof p) p = {name: p};
            if ((p.name.slice(0, 1) === '@') &&  (-1 === p.name.indexOf('/')))
                p.name = `@genjs/genjs-plugin-${p.name.slice(1)}`;
            this.registerPluginFromConfig(p)
        });
    }
    getRootDir(): string {
        return this.rootDir;
    }
    getVars(): {[key: string]: any} {
        return this.vars;
    }
    setVar(key: string, value: any) {
        this.vars[key] = value;
    }
    registerPackager(type: string|string[], packager: (config: any) => IPackage) {
        (Array.isArray(type) ? type : [type]).forEach(t => {
            const tt = t.replace(/-/g, '_');
            this.packagers[t] = packager;
            if (tt !== t) {
                this.packagers[tt] = packager;
            }
        });
    }
    registerPackageEventHook(packageType: string, eventType: string, hook: Function): void {
        if (!this.packageEventHooks[packageType]) this.packageEventHooks[packageType] = {};
        if (!this.packageEventHooks[packageType][eventType]) this.packageEventHooks[packageType][eventType] = [];
        this.packageEventHooks[packageType][eventType].push(hook);
    }
    registerGroupEventHook(eventType: string, hook: Function): void {
        if (!this.groupEventHooks[eventType]) this.groupEventHooks[eventType] = [];
        this.groupEventHooks[eventType].push(hook);
    }
    registerGlobalEventHook(eventType: string, hook: Function): void {
        if (!this.globalEventHooks[eventType]) this.globalEventHooks[eventType] = [];
        this.globalEventHooks[eventType].push(hook);
    }
    async describePackages(): Promise<any[]> {
        return (await this.prepare()).reduce((acc, [g, x]) => {
            return acc.concat(x.map((p: any) => {
                const name = p.getName ? p.getName() : p.name;
                return {
                    name,
                    type: p.getPackageType ? p.getPackageType() : p.packageType,
                    group: g.getName(),
                    dir: g.getDir() === '.' ? name : `${g.getDir()}/${name}`,
                };
            }));
        }, <any[]>[]);
    }
    protected applyPackageEventHooks(p: IPackage, eventType: string, data: any = {}, g: PackageGroup): void {
        let hooks = <Function[]>[];
        const packageType = p.getPackageType ? p.getPackageType() : (p['packageType'] ? p['packageType'] : undefined);
        if (!packageType) return;
        if (this.packageEventHooks[packageType]) {
            if (this.packageEventHooks[packageType][eventType])
                hooks = hooks.concat(this.packageEventHooks[packageType][eventType]);
            if (this.packageEventHooks[packageType]['*'])
                hooks = hooks.concat(this.packageEventHooks[packageType]['*']);
        }
        if (this.packageEventHooks['*']) {
            if (this.packageEventHooks['*'][eventType])
                hooks = hooks.concat(this.packageEventHooks['*'][eventType]);
            if (this.packageEventHooks['*']['*'])
                hooks = hooks.concat(this.packageEventHooks['*'][eventType]);
        }
        const ctx = {data, globalContext: this.globalContext, group: g};
        hooks.forEach(h => h(p, eventType, ctx));
    }
    protected applyGroupEventHooks(g: PackageGroup, eventType: string, data: any = {}): void {
        let hooks = <Function[]>[];
        if (this.groupEventHooks[eventType])
            hooks = hooks.concat(this.groupEventHooks[eventType]);
        if (this.groupEventHooks['*'])
            hooks = hooks.concat(this.groupEventHooks['*']);
        const ctx = {data, globalContext: this.globalContext};
        hooks.forEach(h => h(g, eventType, ctx));
    }
    protected applyGlobalEventHooks(eventType: string, data: any = {}): void {
        let hooks = <Function[]>[];
        if (this.globalEventHooks[eventType])
            hooks = hooks.concat(this.globalEventHooks[eventType]);
        if (this.globalEventHooks['*'])
            hooks = hooks.concat(this.globalEventHooks['*']);
        const ctx = {data, globalContext: this.globalContext};
        hooks.forEach(h => h(this, eventType, ctx));
    }
    registerPredefinedTargets(targets: {[key: string]: any}) {
        Object.assign(this.predefinedTargets, targets);
        return this;
    }
    registerPlugin(plugin: IPlugin) {
        plugin.register(this);
        this.plugins.push(plugin);
    }
    registerRegistryFactory(type: string|string[], factory: (cfg: any) => IRegistry) {
        (Array.isArray(type) ? type : [type]).forEach(t => {
            const tt = t.replace(/-/g, '_');
            this.registryFactories[t] = factory;
            if (tt !== t) {
                this.registryFactories[tt] = factory;
            }
        });
    }
    registerRegistry(type: string, cfg: BaseRegistryConfig) {
        if (!this.registryFactories[type]) throw new Error(`No registered registry factory for type '${type}'`);
        this.registries.push(this.registryFactories[type](cfg));
        return this;
    }
    registerPluginFromConfig(plugin: string|PluginConfig) {
        this.registerPlugin(this.createPluginFromConfig('string' === typeof plugin ? {name: plugin} : plugin));
    }
    createPluginFromConfig(plugin: PluginConfig): IPlugin {
        let path = plugin.path || plugin.name;
        if ('.' === path.slice(0, 1)) {
            path = fs.realpathSync(`${this.rootDir}/${path}`);
        }
        const r = require(path);
        const pluginClass = r.default || r;

        return new pluginClass({...(plugin.config || {}), loadedFrom: path});
    }
    private async prepare(): Promise<[PackageGroup, IPackage[]][]> {
        const configEnhancer = new PackageConfigEnhancer(this.getAsset.bind(this));
        return Object.values(this.groups).reduce((acc, g) => {
            const pkgs = (<PackageGroup>g).getPackages();
            this.applyGroupEventHooks(g, 'before_prepare', {packages: pkgs});
            acc.push([g, pkgs.map(
                ({name, type, ...c}: any) => {
                    if (!type) {
                        if (!this.vars.defaultPackageType) throw new Error(`No type specified for package '${name}'`);
                        type = this.vars.defaultPackageType;
                    }
                    if (!this.packagers[type]) throw new Error(`Unsupported package type '${type}'`);
                    const targetDir = g.getDir() === '.' ? name : `${g.getDir()}/${name}`;
                    const localConfig = configEnhancer.enrich({...c, predefinedTargets: this.predefinedTargets, getAsset: this.getAsset.bind(this), packageType: type, targetDir, name, vars: {...this.vars, ...(c.vars || {})}});
                    const p = this.packagers[type](localConfig);
                    this.applyPackageEventHooks(p, 'created', localConfig, g);
                    return p;
                }
            )]);
            this.applyGroupEventHooks(g, 'prepared', {packages: pkgs});
            return acc;
        }, <[PackageGroup, IPackage[]][]>[]);
    }
    public getAsset(type: string, name: string) {
        const r = this.registries.find(r => r.hasAsset(type, name));
        if (!r) throw new Error(`Unknown asset '${name}' of type '${type}'`);
        return r.getAsset(type, name);
    }
    private async preGenerate(groupments: [PackageGroup, IPackage[]][], vars: any): Promise<any> {
        const description = {};
        await groupments.reduce(async (acc, [g, packages]) => {
            await acc;
            vars.verbose = vars.verbose || process.env.GENJS_VERBOSE || 0;
            await packages.reduce(async (acc, p) => {
                await acc;
                this.applyPackageEventHooks(p, 'before_describe', {}, g);
                populateData(description, p.describe ? await p.describe() : {})
                this.applyPackageEventHooks(p, 'after_describe', description, g);
            }, Promise.resolve());
        }, Promise.resolve());
        return description;
    }
    async generate(vars: any = {}): Promise<{[key: string]: Function}> {
        const groupments = await this.prepare();
        const description = await this.preGenerate(groupments, vars);
        this.applyGlobalEventHooks('before_generate');
        const r = await ((groupments).reduce(async (acc, [g, packages]) => {
            const result = await acc;
            vars.verbose = vars.verbose || process.env.GENJS_VERBOSE || 0;
            const {write = false, targetDir} = vars;
            this.applyGroupEventHooks(g, 'before');
            await packages.reduce(async (acc, p) => {
                await acc;
                description.projectData = {};
                this.applyPackageEventHooks(p, 'before_hydrate', description, g);
                p.hydrate && await p.hydrate(description);
                this.applyPackageEventHooks(p, 'after_hydrate', description, g);
                delete description.projectData;
            }, Promise.resolve());
            const rr = (await Promise.all(packages.map(async p => {
                const n = (<any>p).getName ? (<any>p).getName() : p['name'];
                this.applyPackageEventHooks(p, 'before_generate', {}, g);
                const generateResult = p.generate ? await p.generate(vars) : {};
                this.applyPackageEventHooks(p, 'after_generate', generateResult, g);
                return [n, generateResult];
            })))
                .reduce(
                    (acc2, [p, f]) =>
                        Object.entries(f).reduce((acc3, [k, v]) => {
                            acc3[`${p}/${k}`] = [p, v];
                            return acc3;
                        }, acc2)
                    ,
                    {}
                )
            ;
            this.applyGroupEventHooks(g, 'after');
            const entries = Object.entries(rr);
            entries.sort(([k1], [k2]) => k1 < k2 ? -1 : (k1 === k2 ? 0 : 1));
            entries.forEach(([k, x]) => {
                const [p, v] = <any>x;
                const filePath = `${this.computeTargetDir(targetDir, g.getDir())}/${k}`;
                if (!this.isFileLocked(filePath, targetDir)) {
                    if (vars.verbose >= 1) console.log(g.getName(), k);
                    const t: ITemplate = isTemplate(v) ? v : new Template(v);
                    const fileCopy = (source, target) => copy(
                        source,
                        `${this.computeTargetDir(targetDir, g.getDir())}/${p}/${target}`
                    )
                    const xxx = t.render({copy: fileCopy});
                    if (undefined !== xxx) {
                        rr[k] = xxx;
                        if (write && (true !== rr[k])) writeFile(filePath, rr[k]);
                    }
                }
            });
            Object.assign(result, rr);
            return result;
        }, Promise.resolve({})));
        this.applyGlobalEventHooks('generated', r);
        return r;
    }
    init(): void {
        writeFile(
            `${this.rootDir}/genjs.js`,
            renderFile({templatePath: `${__dirname}/../templates`})('genjs.js.ejs', {config: jsStringify({
                plugins: [],
                vars: {},
                packages: {},
            })})
        );
    }
    private isFileLocked(targetPath, targetDir): boolean {
        const a = path.resolve(targetPath);
        const b = path.resolve(targetDir);
        if (a.slice(0, b.length) === b) {
            const c = a.slice(b.length);
            if (!!this.locked[c]) return true;
            const tokens = c.split(/\//g);
            let cc;
            do {
                tokens.pop();
                cc = tokens.join('/');
                (cc !== '/') && (cc = `${cc}/`)
            } while ((tokens.length > 1) && !this.locked[cc]);
            return !!this.locked[cc];
        }
        return false;
    }
    private computeTargetDir(a: string, b: string): string {
        if ('.' === b) return a;
        return `${a}/${b}`;
    }
}

export default Genjs