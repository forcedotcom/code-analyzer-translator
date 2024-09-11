# CRUD Operation Data With Sharing

An object is updated or created with user controlled data placed into the object in sharing mode.

For example, an update operation occurs in which the user's input overwrites a specific field
in the object without checking whether the user has FLS permissions to update that field.

Although the code does enforce that the user has sharing permission to the object as a whole,
field level permissions are not enforced, so that the flow may be used by
users to elevate their privileges and violate organizational security policies.

To fix this in your code, either change the run mode of the flow to user context, or add
procedural logic to verify that the user has permission to access the fields being accessed.

Remember that sharing rules only apply records as a whole, not fields, and it's possible to have sharing access to 
a record without access to all the fields in that record.


