public abstract class Parent {
    public void aMethod() {
        if(true) {
            aPrivateMethod();
        }
    }

    private void aPrivateMethod() {
        if(true) {
            System.debug('Parent private method is called.');
        }
    }
}