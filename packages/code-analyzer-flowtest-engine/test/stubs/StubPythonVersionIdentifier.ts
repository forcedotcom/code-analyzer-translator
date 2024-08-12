import {SemVer} from "semver";
import {PythonVersionIdentifier} from "../../src/lib/python-versioning/PythonVersionIdentifier";

export class StubPythonVersionIdentifier implements PythonVersionIdentifier {
    private versionMap: Map<string, SemVer>;

    public constructor(versionMap: Map<string, SemVer>) {
        this.versionMap = versionMap;
    }

    public identifyPythonVersion(pythonCommand: string): Promise<SemVer> {
        if (this.versionMap.has(pythonCommand)) {
            return Promise.resolve(this.versionMap.get(pythonCommand) as SemVer);
        }
        return Promise.reject('Nope');
    }

    public static getPython3ValidInstance(): StubPythonVersionIdentifier {
        return new StubPythonVersionIdentifier(new Map([
            ['python3', new SemVer('3.10.0')]
        ]));
    }
}