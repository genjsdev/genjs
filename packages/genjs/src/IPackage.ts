export interface IPackage {
    getPackageType(): string,
    getAsset(type: string, name: string): any,
    getName(): string;
    getDescription(): string;
    getParameter(name: string, defaultValue?: any): any;
    getFeatures(): any;
    getExtraOptions(): any;
    getExtraOption(name: string, defaultValue?: any): any;
    hasFeature(name: string, defaultValue? : boolean): boolean;
    describe(): Promise<any>;
    hydrate(data): Promise<void>;
    generate(vars: any): Promise<{[key: string]: Function}>;
}

export default IPackage;
