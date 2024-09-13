import os
import sys
import logging
import argparse

import flowtest.executor as executor
import flowtest.util as util
import flowtest.version as version
from flowtest.util import make_id

CURR_DIR = os.getcwd()


def check_file_exists(x: str) -> str:
    """checks if the file exists, otherwise it raises an ArgumentTypeError

    Args:
        x: filepath

    Returns:
        filepath
    """
    if not os.path.exists(x):
        raise argparse.ArgumentTypeError("{0} does not exist".format(x))
    return x


def check_dir_exists(x: str) -> str:
    """Checks if the argument is a valid directory. Raises ArgumentTypeError if not.

    Args:
        x: string to check

    Returns:
        None
    """
    if not os.path.isdir(x):
        raise argparse.ArgumentTypeError("{0} is not a directory".format(x))
    return x


def check_not_exist(x: str) -> str:
    """lambda that checks if this path exists or not. Raises an error if it does exist.

    Args:
        x: string to check

    Returns:
        string
    """
    if os.path.exists(x):
        raise argparse.ArgumentTypeError("{0} already exists!".format(x))
    return x


def get_flow_paths(args: argparse.Namespace) -> (list[str], {str: str}):
    """Given the arguments parsed by argparse, returns the flow filenames and names
    that should be processed.

    Args:
        args: argparse Namespace (parsed arguments)

    Returns:
        a tuple of (list of all flows to scan, dict: flow_name ->
        flow_path)
    """
    arg_flow = args.flow
    arg_dir = args.dir

    if arg_flow is None and arg_dir is None:
        arg_dir = CURR_DIR

    if arg_flow is not None:
        print(f"scanning the single flow: {arg_flow}")
        return [arg_flow], util.get_flows_in_dir(os.path.dirname(os.path.abspath(arg_flow)))

    elif arg_dir is not None:
        flow_paths = util.get_flows_in_dir(arg_dir)
        count = len(flow_paths)
        if count > 0:
            print(f"found {count} flows to scan in {arg_dir}")
            return list(flow_paths.values()), flow_paths
        else:
            print("No flow files found to scan. Exiting...")
            sys.exit(1)


def parse_args(my_args: list[str], default: str = None) -> argparse.Namespace:
    """Defines parameters for argument parsing

    Args:
        default: unique id for this scan. If None provided, one is generated.
        my_args: argument list (complete, so my_args[0] is the program
            name)

    Returns:
        argparse Namespace (parsed arguments)
    """
    if default is None:
        default = make_id()

    parser = argparse.ArgumentParser(
        prog=my_args[0].split(os.sep)[-1],
        description="Static Analysis of Salesforce Flows",
        epilog="Please reach out to your security contact with feedback and bugreports",
    )
    """
        most important option
    """
    parser.add_argument("-v", "--version", action='version',
                        version='%(prog)s ' + version.__version__)
    """
        Options for which flows to scan    
    """
    paths = parser.add_mutually_exclusive_group()

    paths.add_argument("-f", "--flow", help=("path of flow-meta.xml file if only a single "
                                             "flow is to be scanned"),
                       type=check_file_exists, required=False)
    paths.add_argument("-d", "--dir", help=("directory containing flow-meta.xml files "
                                            "subdirectories are also searched. Defaults to working directory."),
                       type=check_dir_exists)

    """
        Options for debug/log handling
    """
    parser.add_argument("--log_file", default=f".flowtest_log_{default}.log",
                        help="path to store logs. If missing, one will be generated",
                        type=check_not_exist)

    parser.add_argument("--debug", action='store_true', help="whether to set logging level to debug")

    """
        Options for storing reports
    """
    parser.add_argument("-j", "--json", default=None,
                        help="path to store json report file.",
                        type=check_not_exist)
    parser.add_argument("-x", "--xml", required=False,
                        help="path to store xml report file.",
                        type=check_not_exist)
    parser.add_argument("-t", "--html", required=False,
                        help="Path to store html report", type=check_not_exist)

    """
        Options for labeling reports
    """
    parser.add_argument("-i", "--id", default=default,
                        help="Id of generated report.")
    parser.add_argument("-r", "--requestor", required=False, help="email address of report recipient.")

    parser.add_argument("-u", "--url", required=False, help="URL to put into report for more information.")
    parser.add_argument("-l", "--label", required=False, help="human readable label to put in report.")
    parser.add_argument("--service_version", default=version.__version__, help="version of system running the command")
    """
        Options for custom query loads
    """
    parser.add_argument("--query_path", required=False, help="path of custom query python file")
    parser.add_argument("--query_class", required=False, help="name of class to instantiate in query_path")
    parser.add_argument("--preset", required=False, help="name of preset to use (consumed by query code)")

    return parser.parse_args(my_args[1:])


# For testing, we allow specifying an argv to main
def main(argv: list[str] = None) -> None:
    """Main entry point to CLI command. For testing, we allow specifying
    the argv list.

    Args:
        argv: (for testing) list of arguments passed into CLI command

    Returns:
        None
    """
    default = make_id()

    if argv is None:
        argv = sys.argv

    args = parse_args(argv, default=default)

    # logging
    if args.debug is True:
        log_level = logging.DEBUG
    else:
        log_level = logging.WARNING

    setup_logger(level=log_level, log_file=args.log_file)

    if args.query_path is not None and args.query_class is None:
        raise argparse.ArgumentTypeError("A query_class must be provided if a query_path is set")

    elif args.query_path is None and args.query_class is not None:
        raise argparse.ArgumentTypeError("A query_path must be provided if a query_class is set")

    flow_paths, all_flows = get_flow_paths(args)
    if args.label is None:
        if len(flow_paths) == 1:
            label = f"scan of {flow_paths[0]}"
        else:
            tmp = args.dir or CURR_DIR
            tmp = tmp.split(os.path.sep)[-1]
            label = f"flowscan of {tmp}"
    else:
        label = args.label

    query_manager = None

    # make sure a report has been chosen
    if args.html is None and args.xml is None and args.json is None:
        raise argparse.ArgumentTypeError("No report format chosen")

    for flow_path in flow_paths:
        print(f"scanning {flow_path}...")
        query_manager = executor.parse_flow(flow_path,
                                            requestor=args.requestor,
                                            report_label=label,
                                            result_id=args.id,
                                            service_version=args.service_version,
                                            help_url=args.url,
                                            query_manager=query_manager,
                                            query_module_path=args.query_path,
                                            query_class_name=args.query_class,
                                            query_preset=args.preset,
                                            all_flows=all_flows)

    print("scanning complete.")
    if args.xml is not None:
        xml_rep = query_manager.results.get_cx_xml_str()
        with open(args.xml, 'w') as fp:
            fp.write(xml_rep)

        print(f"xml result file written to {args.xml}")

    if args.html is not None:
        query_manager.results.write_html(args.html)

        print(f"html result file written to {args.html}")

    if args.json is not None:
        with open(args.json, 'w') as fp:
            query_manager.results.dump_json(fp)

        print(f"json result file written to {args.json}")


def setup_logger(level, log_file: str):
    """Setup logger for scan run

    Args:
        level: logging.Level
        log_file: path to store logs

    Returns:
        None
    """
    # create logger
    logger = logging.getLogger()
    logger.setLevel(level)

    # create file handler for regular logging
    fh = logging.FileHandler(log_file)
    fh.setLevel(level)
    ch = logging.StreamHandler(sys.stderr)
    ch.setLevel(logging.CRITICAL)

    # create formatter
    formatter = logging.Formatter('%(asctime)s | %(name)s | %(levelname)s | %(message)s')

    # add formatter to fh
    fh.setFormatter(formatter)
    ch.setFormatter(formatter)

    # add to logger
    logger.addHandler(fh)
    logger.addHandler(ch)

    print(f"logfile is {log_file}")


if __name__ == "__main__":
    main()
