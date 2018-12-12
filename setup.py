"""
Setup module for the jupyterlab-gitlab proxy extension
"""
from setuptools import setup


with open("README.md") as f:
    long_description = f.read()


setup(
    name="jupyterlab-gitlab",
    author="Benjamin Bertrand",
    author_email="beenje@gmail.com",
    description="A Jupyter Notebook server extension which acts as a proxy for the GitLab API.",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://gitlab.com/beenje/jupyterlab-gitlab",
    license="BSD",
    version="0.1.0",
    install_requires=["notebook"],
    py_modules=["jupyterlab_gitlab"],
    include_package_data=True,
    data_files=[
        (
            "etc/jupyter/jupyter_notebook_config.d",
            ["jupyter-config/jupyter_notebook_config.d/jupyterlab_gitlab.json"],
        )
    ],
    platforms="Linux, Mac OS X, Windows",
    keywords=["Jupyter", "JupyterLab", "GitLab"],
    python_requires=">=3.5",
    classifiers=[
        "Intended Audience :: Developers",
        "Intended Audience :: System Administrators",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: BSD License",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
    ],
)
