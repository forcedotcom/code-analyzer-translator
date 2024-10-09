public virtual class Parent {
    private void aPrivateMethod() {
     System.debug('Parent private method is called.');
    }
    public void aMethod() {
     aPrivateMethod();
    }
}