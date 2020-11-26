import {
    AbstractPackage,
    GitIgnoreTemplate,
    LicenseTemplate,
    MakefileTemplate,
    ReadmeTemplate,
    PackageExcludesTemplate,
    TerraformToVarsTemplate,
    DeployableBehaviour,
    StartableBehaviour,
    BuildableBehaviour,
    CleanableBehaviour,
    InstallableBehaviour,
    GenerateEnvLocalableBehaviour,
    TestableBehaviour,
} from '@genjs/genjs';

export default class Package extends AbstractPackage {
    protected getBehaviours() {
        return [
            new BuildableBehaviour(),
            new CleanableBehaviour(),
            new InstallableBehaviour(),
            new GenerateEnvLocalableBehaviour(),
            new TestableBehaviour(),
            new StartableBehaviour(),
            new DeployableBehaviour(),
        ];
    }
    protected getDefaultExtraOptions(): any {
        return {
            phase: 'pre',
        };
    }
    protected getTemplateRoot(): string {
        return `${__dirname}/../templates`;
    }
    // noinspection JSUnusedLocalSymbols
    protected buildDefaultVars(vars: any): any {
        return {
            project_name: 'project',
            scripts: {
                "build": "build-package"
            },
            dependencies: {
                "@ohoareau/build-package": "^0.1.0"
            }
        };
    }
    // noinspection JSUnusedLocalSymbols,JSUnusedGlobalSymbols
    protected async buildDynamicFiles(vars: any, cfg: any): Promise<any> {
        return {
            ['package.json']: () => JSON.stringify({
                name: vars.name,
                license: vars.license,
                dependencies: vars.dependencies,
                scripts: vars.scripts,
                devDependencies: vars.devDependencies,
                version: vars.version,
                description: vars.description,
                author: (vars.author && ('object' === typeof vars.author)) ? vars.author : {name: vars.author_name, email: vars.author_email},
                private: true,
            }, null, 4),
            ['LICENSE.md']: this.buildLicense(vars),
            ['README.md']: this.buildReadme(vars),
            ['package-excludes.lst']: this.buildPackageExcludes(vars),
            ['.gitignore']: this.buildGitIgnore(vars),
            ['Makefile']: this.buildMakefile(vars),
            ['terraform-to-vars.json']: this.buildTerraformToVars(vars),
        };
    }
    protected buildLicense(vars: any): LicenseTemplate {
        return new LicenseTemplate(vars);
    }
    protected buildReadme(vars: any): ReadmeTemplate {
        return new ReadmeTemplate(vars);
    }
    protected buildPackageExcludes(vars: any): PackageExcludesTemplate {
        return new PackageExcludesTemplate(vars);
    }
    protected buildGitIgnore(vars: any): GitIgnoreTemplate {
        return new GitIgnoreTemplate(vars.gitignore || {})
            .addIgnore('/coverage/')
            .addIgnore('/node_modules/')
            .addIgnore('/vendor/')
            .addIgnore('/composer.phar')
            .addIgnore('/build/')
            .addIgnore('/reports/')
            .addIgnore('/.idea/')
            .addIgnore('/.env')
            .addIgnore('/web/bundles/')
            .addIgnore('/app/bootstrap.php.cache')
            .addIgnore('/app/cache/*')
            .addNonIgnore('/app/cache/.gitkeep')
            .addIgnore('/app/logs/*')
            .addNonIgnore('/app/logs/.gitkeep')
            .addIgnore('/app/files/*')
            .addNonIgnore('/app/files/.gitkeep')
            .addIgnore('/bin/doctrine*')
            .addIgnore('/bin/phpunit')
            .addIgnore('/app/config/parameters.yml')
        ;
    }
    protected buildMakefile(vars: any): MakefileTemplate {
        const t = new MakefileTemplate({makefile: false !== vars.makefile, ...(vars.makefile || {})})
            .addGlobalVar('prefix', vars.project_prefix)
            .addGlobalVar('bucket_prefix', vars.bucket_prefix ? vars.bucket_prefix : `$(prefix)-${vars.project_name}`)
            .addGlobalVar('env', 'dev')
            .addGlobalVar('AWS_PROFILE', `${vars.aws_profile_prefix || '$(prefix)'}-$(env)`)
            .addGlobalVar('bucket', vars.bucket ? vars.bucket : `$(env)-$(bucket_prefix)-${vars.name}-assets`)
            .addGlobalVar('cloudfront', vars.cloudfront ? vars.cloudfront : `$(AWS_CLOUDFRONT_DISTRIBUTION_ID_${vars.name.toUpperCase()}_ASSETS)`)
            .addGlobalVar('symfony_env', vars.symfony_env ? vars.symfony_env : `$(env)`)
            .setDefaultTarget('install')
            .addMetaTarget('install', ['install-js', 'install-php'])
            .addPredefinedTarget('install-js', 'yarn-install')
            .addPredefinedTarget('build-package', 'yarn-build')
            .addTarget('build-assets', ['rm -rf build/assets', 'mkdir -p build/assets', 'cp -LR web/* build/assets/', 'rm -f build/assets/*.php'])
            .addPredefinedTarget('generate-env-local', 'generate-env-local')
            .addMetaTarget('clean', ['clean-modules', 'clean-coverage', 'clean-vendor', 'clean-build', 'clean-web-bundles'])
            .addPredefinedTarget('clean-modules', 'clean-node-modules')
            .addPredefinedTarget('clean-coverage', 'clean-coverage')
            .addPredefinedTarget('clean-vendor', 'clean-vendor')
            .addPredefinedTarget('clean-web-bundles', 'clean-web-bundles')
            .addPredefinedTarget('clean-build', 'clean-build')
            .addPredefinedTarget('test', 'composer-test', {ci: true, coverage: true})
            .addPredefinedTarget('test-dev', 'composer-test', {local: true, all: true, coverage: false, color: true})
            .addPredefinedTarget('test-cov', 'composer-test', {local: true})
            .addPredefinedTarget('test-ci', 'composer-test', {ci: true})
            .addPredefinedTarget('deploy-assets', 'aws-s3-sync', {source: 'build/assets/'})
            .addPredefinedTarget('invalidate-cache', 'aws-cloudfront-create-invalidation')
            .addMetaTarget('deploy', ['deploy-assets', 'invalidate-cache'])
            .addTarget('start', [`SYMFONY_DEBUG=true SYMFONY_ENV=dev app/console server:run --ansi -n -p ${this.getParameter('startPort')}`], [], {sourceLocalEnvLocal: !!vars.env_local_required})
            .addTarget('build-cache', [`SYMFONY_ENV=$(symfony_env) app/console cache:warmup --ansi -n --no-debug`], [], {sourceLocalEnvLocal: !!vars.env_local_required})
        ;
        const buildSteps = ['build-assets', 'clean-web-bundles', 'build-package'];
        if (vars.download_on_build) {
            t
                .addTarget('build-downloads', Object.entries(vars.download_on_build).map(([k, v]) => {
                    return `rm -f ${k} && curl -sL ${v} -o ${k}`;
                }))
            ;
            buildSteps.push('build-downloads');
        }
        if (!!vars.env_local_required) {
            t
                .addPredefinedTarget('install-php', 'composer-install', {sourceLocalEnvLocal: !!vars.env_local_required}, [], ['generate-env-local'])
                .addPredefinedTarget('install-php-prod', 'composer-install-prod', {sourceLocalEnvLocal: !!vars.env_local_required}, [], ['generate-env-local'])
            ;
        } else {
            t
                .addPredefinedTarget('install-php', 'composer-install')
                .addPredefinedTarget('install-php-prod', 'composer-install-prod')
            ;
        }
        t
            .addMetaTarget('build', ['install-php-prod', ...(vars.build_cache_before_deploy ? ['build-cache'] : []), ...buildSteps, 'install-php'])
        ;
        return t;
    }
    protected buildTerraformToVars(vars: any): TerraformToVarsTemplate {
        return new TerraformToVarsTemplate(vars);
    }
    protected getTechnologies(): any {
        return [
            'symfony',
            'php',
            'phpenv',
            'make',
            'aws_cli',
            'aws_lambda',
            'node',
            'es6',
            'yarn',
            'nvm',
            'npm',
            'markdown',
            'git',
            'composer',
            'json',
        ];
    }
}