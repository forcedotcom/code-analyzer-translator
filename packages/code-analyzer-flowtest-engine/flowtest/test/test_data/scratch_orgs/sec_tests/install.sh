#!/usr/bin/env bash
#
#  Bootstrap script for setting up scratch org for security tests
#

#
#  create scratch org
sf org create scratch -f config/project-scratch-def.json -a sec_test

# import data for both objects
sf force:data:tree:import -o sec_test --plan config/data/export_not_shared-not_shared__c-plan.json
sf force:data:tree:import -o sec_test --plan config/data/export_shared-shared__c-plan.json

#
#  create standard user with permset assigned
sf force user create -f config/user-def.json -o sec_test
