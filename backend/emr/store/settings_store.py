from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

from cryptography.fernet import Fernet

from emr.contracts import SettingsRoot


SECRET_FIELDS = {"api_key", "auth_token"}
ENCRYPTED_PREFIX = "fernet:"
DEFAULT_CONFIG_DIR = Path.home() / ".config" / "emr-analyzer"
DEFAULT_SETTINGS_PATH = DEFAULT_CONFIG_DIR / "settings.json"


class SettingsStore:
    def __init__(
        self,
        config_dir: str | Path | None = None,
        *,
        encryption_key: bytes | str | None = None,
        key_provider: Callable[[], bytes | str] | None = None,
    ) -> None:
        self.config_dir = Path(config_dir).expanduser() if config_dir is not None else DEFAULT_CONFIG_DIR
        self.settings_path = self.config_dir / "settings.json"
        self._key_path = self.config_dir / ".fernet.key"
        self._encryption_key = encryption_key
        self._key_provider = key_provider

    def save(self, settings: SettingsRoot) -> None:
        self.config_dir.mkdir(parents=True, exist_ok=True)
        data = settings.model_dump(mode="json")
        encrypted = self._transform_secrets(data, self._encrypt_secret)
        self.settings_path.write_text(json.dumps(encrypted, indent=2, ensure_ascii=False), encoding="utf-8")

    def load(self) -> SettingsRoot:
        raw = json.loads(self.settings_path.read_text(encoding="utf-8"))
        decrypted = self._transform_secrets(raw, self._decrypt_secret)
        return SettingsRoot.model_validate(decrypted)

    def to_api_safe_dict(self, settings: SettingsRoot | None = None) -> dict[str, Any]:
        current = settings or self.load()
        data = current.model_dump(mode="json")
        return self._transform_secrets(data, self._mask_secret)

    def _transform_secrets(self, value: Any, transform: Callable[[str], str]) -> Any:
        if isinstance(value, dict):
            return {
                key: self._transform_secrets(val, transform) if key not in SECRET_FIELDS else self._transform_secret_value(val, transform)
                for key, val in value.items()
            }
        if isinstance(value, list):
            return [self._transform_secrets(item, transform) for item in value]
        return value

    @staticmethod
    def _transform_secret_value(value: Any, transform: Callable[[str], str]) -> Any:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        return transform(value)

    def _encrypt_secret(self, value: str) -> str:
        if value.startswith(ENCRYPTED_PREFIX):
            return value
        token = self._fernet().encrypt(value.encode("utf-8")).decode("utf-8")
        return f"{ENCRYPTED_PREFIX}{token}"

    def _decrypt_secret(self, value: str) -> str:
        if not value.startswith(ENCRYPTED_PREFIX):
            return value
        token = value.removeprefix(ENCRYPTED_PREFIX).encode("utf-8")
        return self._fernet().decrypt(token).decode("utf-8")

    @staticmethod
    def _mask_secret(value: str) -> str:
        if not value:
            return value
        return "***MASKED***"

    def _fernet(self) -> Fernet:
        key = self._resolve_key()
        if isinstance(key, str):
            key = key.encode("utf-8")
        return Fernet(key)

    def _resolve_key(self) -> bytes | str:
        if self._encryption_key is not None:
            return self._encryption_key
        if self._key_provider is not None:
            return self._key_provider()
        return self._default_key_provider()

    def _default_key_provider(self) -> bytes:
        self.config_dir.mkdir(parents=True, exist_ok=True)
        if self._key_path.exists():
            return self._key_path.read_bytes().strip()
        key = Fernet.generate_key()
        self._key_path.write_bytes(key)
        return key
