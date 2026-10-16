"""Practice-mode registry.

Every module in this folder that defines a module-level `MODE` is registered
automatically. To add a mode, drop a new file here; nothing else needs editing.
"""

import importlib
import pkgutil

from .base import Mode

MODES: dict[str, Mode] = {}

for _info in pkgutil.iter_modules(__path__):
    if _info.name == "base":
        continue
    _module = importlib.import_module(f"{__name__}.{_info.name}")
    _mode = getattr(_module, "MODE", None)
    if isinstance(_mode, Mode):
        MODES[_mode.id] = _mode


def ordered() -> list[Mode]:
    return sorted(MODES.values(), key=lambda m: (m.order, m.title))
