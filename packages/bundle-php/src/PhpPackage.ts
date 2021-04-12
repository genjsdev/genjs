import {BasePackage} from '@genjs/genjs-bundle-package';
import {
    BuildableBehaviour,
    CleanableBehaviour,
    DeployableBehaviour,
    GenerateEnvLocalableBehaviour,
    InstallableBehaviour,
    StartableBehaviour,
    TestableBehaviour
} from '@genjs/genjs';

export class PhpPackage extends BasePackage {
    protected getBehaviours() {
        return [
            ...super.getBehaviours(),
            new BuildableBehaviour(),
            new CleanableBehaviour(),
            new InstallableBehaviour(),
            new DeployableBehaviour(),
            new GenerateEnvLocalableBehaviour(),
            new StartableBehaviour(),
            new TestableBehaviour(),
        ]
    }
    protected buildMakefile(vars: any) {
        return super.buildMakefile(vars)
            .addGlobalVar('env', 'dev')
            .addNoopTarget('install')
            .addNoopTarget('build')
            .addNoopTarget('deploy')
            .addPredefinedTarget('generate-env-local', 'generate-env-local', {prefix: 'PHP'})
            .addNoopTarget('start')
            .addNoopTarget('test')
            ;
    }
    protected getTechnologies() {
        return [
            ...super.getTechnologies(),
            'php',
        ];
    }
}

export default PhpPackage