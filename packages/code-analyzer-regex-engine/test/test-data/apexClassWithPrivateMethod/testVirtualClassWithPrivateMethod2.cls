virtual public class Parent {
    public void aMethod() {
        aPrivateMethod();
    }

    private Map<String,List<String>> aPrivateMethod() {
        System.debug('Parent private method is called.');
    }
}