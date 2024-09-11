"""Generate statistics from a corpus

"""
import json
import os

import flow_parser.parse as parse
from flow_parser.parse import ET
from flowtest.util import get_flows_in_dir

DATA_PATH = os.path.join('test_data', 'corpus')
OUT_DIR = 'test_out'

file_dir = DATA_PATH

if not os.path.exists(DATA_PATH):
    print(f"Please obtain sample code, place it in {DATA_PATH} "
          f"and then run this program to obtain statistics and samples, which will be written to {OUT_DIR}")

if not os.path.exists(OUT_DIR):
    os.makedirs(DATA_PATH)

print(f"searching for flows in {file_dir}...")
all_flows = get_flows_in_dir(file_dir)
print(f"found {len(all_flows)} flows to process")

no_start_or_start_elem = []
no_start = []
element_tags = {}
tag_counts = {}
all_named_elems = {}
all_flow_elems = {}
all_connector_elems = {}
action_histogram = {}

for flow_path in list(all_flows.values()):
    root = ET.parse(flow_path).getroot()
    start = parse.get_by_tag(root, 'start')
    start_ref = parse.get_by_tag(root, 'startElementReference')

    if len(start) == 0:
        no_start.append(flow_path)
        if len(start_ref) == 0:
            no_start_or_start_elem.append(flow_path)

    for elem in root:
        tag_ = parse.get_tag(elem)
        name_elems = parse.get_named_elems(elem)

        # store all named elems (can be children of top level) sorted by tag
        if len(name_elems) > 0:
            for named in name_elems:
                named_tag = parse.get_tag(named)
                if named_tag in all_named_elems:
                    all_named_elems[named_tag].append(ET.tostring(named).decode())
                else:
                    all_named_elems[named_tag] = [ET.tostring(named).decode()]

        # store all top level, sorted by tag with histograms
        if tag_ is not None:
            if tag_ == 'actionCalls':
                for child in elem:
                    if parse.get_tag(child) == 'actionType':
                        action_t = child.text
                        if action_t in action_histogram:
                            action_histogram[action_t] += 1
                        else:
                            action_histogram[action_t] = 1

            if tag_ in tag_counts:
                tag_counts[tag_] += 1
                continue

            else:
                element_tags[tag_] = [flow_path, ET.tostring(elem).decode()]
                tag_counts[tag_] = 1

print("writing to disk in test_out directory 'name_counts.txt,element_examples.json, element.json and no_start.json")

with open(os.path.join(OUT_DIR, 'name_counts.json'), 'w') as fp:
    json.dump(tag_counts, fp, indent=2)

with open(os.path.join(OUT_DIR,'element_examples.json'), 'w') as fp:
    json.dump(element_tags, fp, indent=2)

with open(os.path.join(OUT_DIR,'no_start.json'), 'w') as fp:
    json.dump(no_start, fp, indent=2)

with open(os.path.join(OUT_DIR, 'no_start_or_start_elem.json'), 'w') as fp:
    json.dump(no_start_or_start_elem, fp, indent=2)

with open(os.path.join(OUT_DIR, 'all_named_elem.json'), 'w') as fp:
    json.dump(all_named_elems, fp, indent=2)

with open(os.path.join(OUT_DIR, 'action_histogram.json'), 'w') as fp:
    json.dump(action_histogram, fp, indent=2)

print("Done!")
