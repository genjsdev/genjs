import {parseYaml} from '@genjs/genjs';

export class ConfigEnhancer {
    private readonly assetFetcher: Function;
    constructor({getAsset}) {
        this.assetFetcher = getAsset;
    }
    enhanceConfig(location, type: string|undefined, cfg: any|undefined = {}) {
        cfg = cfg || {};
        if (type) {
            const [rawType, ...mixins] = type.split(/\s*\+\s*/g);
            type = rawType;
            cfg.mixins = this.mergeConfigMixins(cfg.mixins || [], mixins);
        }
        const asset = type ? this.assetFetcher('code', `${location}/${type}`) : {};
        cfg.vars = this.prepareVarsFromAssetInputs(cfg.vars || {} , asset.inputs || {});
        return [asset, cfg];
    }
    enrichConfigMicroservice(v: any) {
        const [asset, cfg] = this.enhanceConfig('microservice', ...this.parseTypeAndConfigFromRawValue(v));
        return this.mergeConfigMicroservice(asset, cfg);
    }
    enrichConfigType(v: any) {
        const [asset, cfg] = this.enhanceConfig('microservice/type', ...this.parseTypeAndConfigFromRawValue(v));
        return this.mergeConfigType(asset, cfg);
    }
    enrichConfigOperation(v: any) {
        const [asset, cfg] = this.enhanceConfig('microservice/type/operation', ...this.parseTypeAndConfigFromRawValue(v));
        return this.mergeConfigOperation(asset, cfg);
    }
    mergeConfigMicroservice(a: any = {}, b: any = {}) {
        const x = this.mergeConfigMicroserviceRaw(a, b);
        const xx = (x.mixins || []).reduce((acc, m) => {
            const [asset, cfg] = this.enhanceConfig('microservice-mixin', ...this.parseTypeAndConfigFromRawValue(m))
            return this.mergeConfigMicroserviceRaw(acc, this.mergeConfigMicroserviceRaw(asset, cfg));
        }, x);
        return this.mergeConfigMicroserviceRaw(xx, x);
    }
    mergeConfigType(a: any = {}, b: any = {}) {
        const x = this.mergeConfigTypeRaw(a, b);
        const xx = (x.mixins || []).reduce((acc, m) => {
            const [asset, cfg] = this.enhanceConfig('microservice/type-mixin', ...this.parseTypeAndConfigFromRawValue(m))
            return this.mergeConfigTypeRaw(acc, this.mergeConfigTypeRaw(asset, cfg));
        }, {});
        return this.mergeConfigTypeRaw(xx, x);
    }
    mergeConfigOperation(a: any = {}, b: any = {}) {
        const x = this.mergeConfigOperationRaw(a, b);
        const xx = (x.mixins || []).reduce((acc, m) => {
            const [asset, cfg] = this.enhanceConfig('microservice/type/operation-mixin', ...this.parseTypeAndConfigFromRawValue(m))
            return this.mergeConfigOperationRaw(acc, this.mergeConfigOperationRaw(asset, cfg));
        }, {});
        return this.mergeConfigOperationRaw(xx, x);
    }
    mergeConfigMicroserviceRaw(a: any, b: any) {
        return {
            ...a,
            ...b,
            mixins: this.mergeConfigMixins(a.mixins, b.mixins),
            types: this.mergeConfigTypes(a.types, b.types),
        };
    }
    mergeConfigTypeRaw(a: any, b: any) {
        return this.mergeConfig(a, b);
    }
    mergeConfigOperationRaw(a: any, b: any) {
        return {
            ...a,
            ...b,
            mixins: this.mergeConfigMixins(a.mixins, b.mixins),
            hooks: this.mergeConfigHooks(a.hooks, b.hooks),
            vars: this.mergeConfigVars(a.vars, b.vars),
        }
    }
    enrichConfigFunction(v: any) {
        const [asset, cfg] = this.enhanceConfig('microservice/type/function', ...this.parseTypeAndConfigFromRawValue(v));
        return this.mergeConfigFunction(asset, cfg);
    }
    mergeConfigMixins(a: any[] = [], b: any[] = []) {
        const mixins = a.concat(b);
        return mixins.reduce((acc, x) => {
            !acc.includes(x) && (acc.push(x));
            return acc;
        }, <any[]>[]);
    }
    mergeConfigFunctionRaw(a: any, b: any) {
        return {
            ...a,
            ...b,
            mixins: this.mergeConfigMixins(a.mixins, b.mixins),
            vars: this.mergeConfigVars(a.vars, b.vars),
        }
    }
    mergeConfigTypes(a: any = {}, b: any = {}) {
        return {...a, ...b};
    }
    mergeConfigHooks(a: any = {}, b: any = {}) {
        return Object.keys(b).reduce((acc, k) => {
            acc[k] = acc[k] || [];
            acc[k] = acc[k].concat(b[k] || []);
            return acc;
        }, a);
    }
    mergeConfigVars(a: any = {}, b: any = {}) {
        return {...a, ...b};
    }
    mergeConfig(a: any = {}, b: any = {}) {
        return {
            ...a,
            ...b,
            handlers: this.mergeConfigHandlers(a.handlers, b.handlers),
            middlewares: this.mergeConfigMiddlewares(a.middlewares, b.middlewares),
            backends: this.mergeConfigBackends(a.backends, b.backends),
            mixins: this.mergeConfigMixins(a.mixins, b.mixins),
            attributes: this.mergeConfigAttributes(a.attributes, b.attributes),
            operations: this.mergeConfigOperations(a.operations, b.operations),
            functions: this.mergeConfigFunctions(a.functions, b.functions),
        };
    }
    mergeConfigHandlers(a: any = {}, b: any = {}) {
        return {...a, ...b};
    }
    mergeConfigMiddlewares(a: any[] = [], b: any[] = []) {
        const middlewares = a.concat(b);
        return middlewares.reduce((acc, b) => {
            if ('string' !== typeof b) acc.push(b)
            else if (!acc.includes(b)) acc.push(b);
            return acc;
        }, <any[]>[]);
    }
    mergeConfigBackends(a: any[] = [], b: any[] = []) {
        const backends = a.concat(b);
        return backends.reduce((acc, b) => {
            if ('string' !== typeof b) acc.push(b)
            else if (!acc.includes(b)) acc.push(b);
            return acc;
        }, <any[]>[]);
    }
    mergeConfigAttributes(a: any = {}, b: any = {}) {
        return {...a, ...b};
    }
    mergeConfigOperations(a: any = {}, b: any = {}) {
        return {...a, ...b};
    }
    mergeConfigFunctions(a: any = {}, b: any = {}) {
        return {...a, ...b};
    }
    mergeConfigFunction(a: any = {}, b: any = {}) {
        const x = this.mergeConfigFunctionRaw(a, b);
        const xx = (x.mixins || []).reduce((acc, m) => {
            const [asset, cfg] = this.enhanceConfig('microservice/type/function-mixin', ...this.parseTypeAndConfigFromRawValue(m))
            return this.mergeConfigFunctionRaw(acc, this.mergeConfigFunctionRaw(asset, cfg));
        }, x);
        return this.mergeConfigFunctionRaw(xx, x);
    }
    enrichConfig(c: any, type: string) {
        const [asset, cfg] = this.enhanceConfig('microservice/type', ...this.parseConfigType(c, type));
        return this.mergeConfig(asset, cfg);
    }

    protected parseConfigType = (cfg: any, type: string): [string|undefined, any|undefined] => {
        const match = type.match(/^([^(]+)\(([^)]*)\)$/);
        let parsedVars = {};
        if (!!match && !!match.length) {
            type = match[1];
            parsedVars = !!match[1] ? match[2].split(/\s*,\s*/g).reduce((acc, t) => {
                const [k, v = undefined] = t.split(/\s*=\s*/)
                if (undefined === v) {
                    acc['default'] = k;
                } else {
                    acc[k] = parseYaml(v || '');
                }
                return acc;
            }, {}) : {};
        }
        cfg = {...cfg, vars: {...parsedVars, ...(cfg.vars || {})}};
        return [type, cfg];
    }
    protected parseTypeAndConfigFromRawValue(v: any): [string|undefined, any|undefined] {
        if ('string' === typeof v) {
            return this.parseConfigType({}, v);
        }
        const {type, ...cfg} = v;
        return type ? this.parseConfigType(cfg, type) : [undefined, cfg];
    }
    protected prepareVarsFromAssetInputs(vars, inputs) {
        return Object.entries(inputs || {}).reduce((acc, [k, v]) => {
            const input = {required: true, type: 'string', ...((null === v || undefined === v) ? {} : <any>v)};
            let value = vars[k] || undefined;
            if (!!input.main && vars.default) value = vars.default;
            (undefined === value) && (value = input.default);
            if ((undefined === value) && input.required) throw new Error(`Required input '${k}' is missing (vars: ${JSON.stringify(vars)}, inputs: ${JSON.stringify(inputs)})`);
            switch (input.type) {
                case 'string': value = String(value); break;
                case 'boolean': value = Boolean(value); break;
                case 'number': value = Number(value); break;
                case 'string[]': value = value.split(/\s*\|\s*/g).map(x => String(x)); break;
                case 'boolean[]': value = value.split(/\s*\|\s*/g).map(x => Boolean(x)); break;
                case 'number[]': value = value.split(/\s*\|\s*/g).map(x => Number(x)); break;
                default: break;
            }
            acc[k] = value;
            return acc;
        }, {});
    }
}

export default ConfigEnhancer