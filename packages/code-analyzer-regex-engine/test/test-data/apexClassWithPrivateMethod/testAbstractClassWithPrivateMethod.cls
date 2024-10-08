public abstract class Parent {
    public void aMethod() {
        aPrivateMethod();
    }
    private void aPrivateMethod() {
        System.debug('Parent private method is called.');
    }
}