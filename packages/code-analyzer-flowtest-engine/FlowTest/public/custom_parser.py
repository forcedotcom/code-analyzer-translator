"""
Custom xml parser

"""
import sys

sys.modules['_elementtree'] = None
import xml.etree.ElementTree as ET


def get_root(path: str) -> ET.Element:
    return ET.parse(path, parser=LineNumberingParser()).getroot()


def get_root_from_string(byte_str) -> ET.Element:
    return ET.fromstring(byte_str, parser=LineNumberingParser())


def to_string(elem: ET.Element) -> str:
    return ET.tostring(elem, encoding='unicode',
                       default_namespace='http://soap.sforce.com/2006/04/metadata').strip()


class LineNumberingParser(ET.XMLParser):
    def _start(self, *args, **kwargs):
        # Here we assume the default XML parser which is expat
        # and copy its element position attributes into output Elements
        element = super(self.__class__, self)._start(*args, **kwargs)
        element.sourceline = self.parser.CurrentLineNumber
        element._start_column_number = self.parser.CurrentColumnNumber
        element._start_byte_index = self.parser.CurrentByteIndex
        return element

    def _end(self, *args, **kwargs):
        element = super(self.__class__, self)._end(*args, **kwargs)
        element._end_line_number = self.parser.CurrentLineNumber
        element._end_column_number = self.parser.CurrentColumnNumber
        element._end_byte_index = self.parser.CurrentByteIndex
        return element
