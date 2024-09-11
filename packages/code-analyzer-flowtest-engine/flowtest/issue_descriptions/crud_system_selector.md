# CRUD Operation Selector in System Mode

User controlled data is used to determine which record is being read, updated, 
or deleted in System Mode without respecting sharing or CRUD/field level security.

For example, a User can control which object is read without having read access to the object. 

To fix this in your code, either change the run mode of the flow to user mode, or add
procedural logic to verify that the user has permission to access the object type and specific
fields that are modified, updated, deleted or returned.

Note that this operation is particularly severe for delete operations, as the user may end up
inadvertently or intentionally deleting the wrong object.