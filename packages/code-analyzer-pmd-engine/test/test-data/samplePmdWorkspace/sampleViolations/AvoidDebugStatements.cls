public class AvoidDebugStatements {
    public void foo() {
        Account acc = [SELECT Name, Owner.Name FROM Account LIMIT 1];
        System.debug(accs); // will get reported
    }
}