import {MakefileTemplate} from '@genjs/genjs';
import path from 'path';
import * as commonTargets from '@genjs/genjs/lib/targets';
import * as javascriptBundleTargets from '@genjs/genjs-bundle-javascript/lib/targets';
import * as awsBundleTargets from '@genjs/genjs-bundle-aws/lib/targets';

const expectRenderSameAsFile = (template: MakefileTemplate, file: string) => {
    expect(template.render()).toEqual(require('fs').readFileSync(path.resolve(`${__dirname}/../__fixtures__/templates/makefiles/${file}`), 'utf8').trim());
};

const predefinedTargets = {...commonTargets, ...javascriptBundleTargets, ...awsBundleTargets};

describe('render', () => {
    it('sample app', () => {
        expectRenderSameAsFile(
            new MakefileTemplate({predefinedTargets})
                .addGlobalVar('prefix', 'myprefix')
                .addGlobalVar('bucket_prefix', '$(prefix)-myproject')
                .addGlobalVar('env', 'dev')
                .addGlobalVar('AWS_PROFILE', '$(prefix)-$(env)')
                .addGlobalVar('bucket', '$(env)-$(bucket_prefix)-app')
                .addGlobalVar('cloudfront', '$(AWS_CLOUDFRONT_DISTRIBUTION_ID_APP)')
                .setDefaultTarget('install')
                .addTarget('pre-install')
                .addPredefinedTarget('install', 'yarn-install')
                .addPredefinedTarget('build', 'yarn-build')
                .addPredefinedTarget('deploy-code', 'aws-s3-sync')
                .addPredefinedTarget('invalidate-cache', 'aws-cloudfront-create-invalidation')
                .addMetaTarget('deploy', ['deploy-code', 'invalidate-cache'])
                .addPredefinedTarget('generate-env-local', 'generate-env-local', {prefix: 'REACT_APP'})
                .addPredefinedTarget('start', 'yarn-start')
                .addPredefinedTarget('test', 'yarn-test-jest', {ci: true, coverage: false})
                .addPredefinedTarget('test-dev', 'yarn-test-jest', {local: true, all: true, coverage: false, color: true})
            ,
            'sample-app.mk'
        );
    })
})