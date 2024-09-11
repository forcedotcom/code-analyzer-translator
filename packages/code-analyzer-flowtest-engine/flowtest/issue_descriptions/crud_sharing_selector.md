# CRUD Operation Selector With Sharing

User controlled data is used to determine which record is being read or updated without respecting 
CRUD/field level security.

For example, a read operation occurs in which the user controls which field is being read, without
checking that the user has permission to read that field 
(even though they may have permission to read the underlying object). 

Because field and object level security are not checked, the flow may be used by
users to gain access to records that the user should not be able to access.

To fix this in your code, either change the run mode of the flow to user context, or add
procedural logic to verify that the user has permission to access the object type and specific
field that are modified, updated, or returned to the user.


Remember that sharing rules only apply records as a whole, not fields, and it's possible to have sharing access to 
a record without access to all the fields in that record.


