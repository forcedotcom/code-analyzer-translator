abstract public class Parent {
    public void aMethod() {
        aPrivateMethod();
    }

    private List<String> aPrivateMethod() {
        System.debug('Parent private method is called.');
    }
}