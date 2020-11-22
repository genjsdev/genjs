module.exports = {
    plugins: [
        '@terraform-infra',
    ],
    vars: {
        author: {
            name: 'Olivier Hoareau',
            email: 'oss@genjs.dev',
        },
    },
    packages: {
        infra: {
            type: 'terraform-infra',
            vars: {
                prefix: 'myothercompany',
                feature_infra_layers: true,
                feature_infra_modules: true,
                layers: {
                    app: {type: 'static-website'},
                    dns: {type: 'dns'},
                    website: {type: 'static-website'},
                }
            },
        }
    }
};
