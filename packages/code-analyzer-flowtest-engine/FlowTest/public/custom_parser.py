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
    return clean_string(ET.tostring(elem, encoding='unicode',
                                    default_namespace='http://soap.sforce.com/2006/04/metadata').strip())


def clean_string(msg: str) -> str:
    """
    removes namespace declarations from xml
        1) <ns0:recordCreates> --> <recordCreates>
        2) </ns0:recordCreates> --> <recordCreates>
        3) <recordCreates xmlns="http://soap.sforce.com/2006/04/metadata"> --> <recordCreates>
        4) <recordCreates xmlns:ns0=\"http://soap.sforce.com/2006/04/metadata\"> --><recordCreates>

    Args:
        msg: string to clean

    Returns:
        cleaned string
    """
    msg1 = msg.replace("<ns0:", "<").replace("</ns0:", "</")
    msg2 = (msg1.replace(' xmlns="http://soap.sforce.com/2006/04/metadata"', '')
            .replace(' xmlns:ns0="http://soap.sforce.com/2006/04/metadata"', ''))
    return msg2


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
