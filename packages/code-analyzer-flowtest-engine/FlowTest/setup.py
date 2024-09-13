from setuptools import setup

from flowtest import version

setup(
    name='flowtest',
    version=version.__version__,
    packages=['flowtest', 'flowtest.data', 'public', 'queries', 'flow_parser'],
    include_package_data=True,
    author='Robert Sussland',
    author_email='rsussland@salesforce.com',
    url='https://git.soma.salesforce.com/rsussland/FlowSecurityLinter',
    entry_points={
        'console_scripts': [
            'flowtest = flowtest.__main__:main'
        ]},
    python_requires='>=3.10.12',
    install_requires=['lxml>=4.9.3', 'lxml-stubs>=0.4.0', 'immutables>=0.20'],
    package_data={'flowtest': ['data/FlowSecurity_preset.txt', 'data/flowtest_query_data.txt',
                               'data/footer.out', 'data/header.out']}
    )

