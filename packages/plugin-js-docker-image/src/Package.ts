import {
    AbstractPackage,
    GitIgnoreTemplate,
    LicenseTemplate,
    ReadmeTemplate,
    TerraformToVarsTemplate,
    MakefileTemplate,
    BuildableBehaviour,
    DeployableBehaviour,
    GenerateEnvLocalableBehaviour,
    InstallableBehaviour,
    TestableBehaviour,
} from '@genjs/genjs';

export default class Package extends AbstractPackage {
    protected getBehaviours() {
        return [
            new BuildableBehaviour(),
            new InstallableBehaviour(),
            new DeployableBehaviour(),
            new GenerateEnvLocalableBehaviour(),
            new TestableBehaviour(),
        ]
    }
    protected getDefaultExtraOptions(): any {
        return {
            phase: 'post',
        };
    }
    protected getTemplateRoot(): string {
        return `${__dirname}/../templates`;
    }
    // noinspection JSUnusedLocalSymbols,JSUnusedGlobalSymbols
    protected buildDefaultVars(vars: any): any {
        return {
            description: 'JS Docker image',
            image_tag: '$(image_tag)',
            image_region: "`echo $$REPOSITORY_URL_PREFIX | cut -d '.' -f 4`",
            image_domain: '$$REPOSITORY_URL_PREFIX',
        };
    }
    protected buildStaticFiles(vars: any, cfg: any): any {
        return {
            ['code/.gitkeep']: '',
        };
    }
    protected async buildDynamicFiles(vars: any, cfg: any): Promise<any> {
        return {
            ['LICENSE.md']: this.buildLicense(vars),
            ['README.md']: this.buildReadme(vars),
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
    protected buildGitIgnore(vars: any): GitIgnoreTemplate {
        return new GitIgnoreTemplate(vars.gitignore || {});
    }
    protected buildMakefile(vars: any): MakefileTemplate {
        return new MakefileTemplate({makefile: false !== vars.makefile, ...(vars.makefile || {})})
            .addGlobalVar('prefix', vars.project_prefix)
            .addGlobalVar('env', 'dev')
            .addGlobalVar('AWS_PROFILE', `${vars.aws_profile_prefix || '$(prefix)'}-$(env)`)
            .addGlobalVar('AWS_DEFAULT_REGION', '$(shell set -a && . ./.env.local && set +a && echo $$REPOSITORY_REGION)')
            .addGlobalVar('ecr_url', '$(shell set -a && . ./.env.local && set +a && echo $$REPOSITORY_URL_PREFIX)')
            .addGlobalVar('image_name', '$(env)-$(subst _,-,$(patsubst %_image,%,$(shell basename `pwd`)))')
            .addGlobalVar('image_tag', '$(ecr_url)/$(image_name):latest')
            .addPredefinedTarget('install-code', 'yarn-install-prod', {dir: 'code'})
            .addPredefinedTarget('build-code', 'yarn-build', {dir: 'code'})
            .addPredefinedTarget('build-image', 'docker-build', {sourceLocalEnvLocal: true, awsProfile: true, awsEcrLogin: true, tag: vars.image_tag, region: vars.image_region, domain: vars.image_domain, path: vars.image_dir || '.', buildArgs: vars.image_buildArgs || {}})
            .addMetaTarget('build', ['build-code', 'build-image'])
            .addMetaTarget('install', ['install-code'])
            .addPredefinedTarget('push', 'docker-push', {sourceLocalEnvLocal: true, awsProfile: true, awsEcrLogin: true, tag: vars.image_tag, region: vars.image_region, domain: vars.image_domain})
            .setDefaultTarget('install')
            .addMetaTarget('deploy', ['push'])
            .addPredefinedTarget('generate-env-local', 'generate-env-local')
        ;
    }
    protected buildTerraformToVars(vars: any): TerraformToVarsTemplate {
        return new TerraformToVarsTemplate(vars);
    }
}