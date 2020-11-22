module.exports = {
    plugins: [
        '@js-lambda-microlib',
    ],
    vars: {
        author: {
            name: 'Olivier Hoareau',
            email: 'oss@genjs.dev',
        },
    },
    packages: {
        api: {
            type: 'js-lambda-microlib',
            vars: {
                dependencies: {
                    dynamoose: "^2.1.2",
                    cors: '^2.8.5',
                },
            },
            handlers: {
                handler: {
                    type: 'apigateway',
                    test: {
                        mocks: [{name: 'mockDynamoose', path: '@ohoareau/microlib/lib/backends/dynamoose', es6: true, factory: true, methods: ['getCurrent']}],
                        groups: {
                            abcd: {
                                tests: [
                                    {
                                        name: 'xyz',
                                        type: 'apigateway-event',
                                        config: {
                                            mocks: [
                                                {name: 'mockDynamoose', method: 'getCurrent', resolved: {id: 'abcd', email: 'test@test.com'}},
                                            ],
                                            method: 'GET',
                                            path: '/user',
                                            body: {},
                                            statusCode: 200,
                                            headers: {},
                                        },
                                    },
                                ],
                            },
                        },
                    },
                    vars: {
                        healthz: true,
                        cors: true,
                        jwt: true,
                        regex_mode: true,
                        routes: {
                            'GET /user': '<private>user_user_getCurrent',
                            'POST /user': '<private>user_user_create',
                            'GET /users/:id': 'user_user_get',
                            'PUT /users/:id': {handler: 'user_user_update', code: 204},
                            'DELETE /users/:id': 'user_user_delete',
                            'POST /non-standard/:route/name': 'user_user_mySpecificMethod',
                        }
                    }
                },
                handlerWithCustomError: {
                    type: 'apigateway',
                    vars: {
                        healthz: true,
                        jwt: true,
                        errors: {
                            404: {code: 403, message: 'You are not allowed to access this resource.'},
                            403: {code: 403, message: 'You are not allowed to access this resource.'},
                            412: {code: 403, message: 'You are not allowed to access this resource.'},
                            500: {code: 403, message: 'You are not allowed to access this resource.'},
                        },
                        routes: {
                            'GET /user': 'user_user_getCurrent',
                            'POST /user': 'user_user_create',
                            'GET /users/:id': 'user_user_get',
                            'PUT /users/:id': 'user_user_update',
                            'DELETE /users/:id': 'user_user_delete',
                            'POST /some-non/standard/:route/:with/id': 'user_user_mySpecificMethod',
                        }
                    }
                },
            },
            microservices: {
                user: {
                    types: {
                        user: {
                            test: {
                                groups: {
                                    g1: {
                                        name: 'g1',
                                        tests: [
                                            {name: 'dummy', type: 'empty'},
                                        ]
                                    }
                                }
                            },
                            backends: ['@dynamoose'],
                            operations: {
                                create: {},
                                get: {},
                                update: {},
                                delete: {},
                                getCurrent: {},
                                mySpecificMethod: {},
                            }
                        }
                    }
                }
            }
        }
    }
};
