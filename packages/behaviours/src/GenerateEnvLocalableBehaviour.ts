import {IPackage, AbstractBehaviour} from "@genjs/genjs";

export class GenerateEnvLocalableBehaviour extends AbstractBehaviour {
    public build(p: IPackage) {
        return {
            features: {
                generateEnvLocalable: true,
            },
        };
    }
}

export default GenerateEnvLocalableBehaviour