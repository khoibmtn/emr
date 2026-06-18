from __future__ import annotations

import json
from pathlib import Path

from cryptography.fernet import Fernet

from emr.contracts import SettingsRoot, Stage2Mode
from emr.store.settings_store import SettingsStore


def build_settings() -> SettingsRoot:
    return SettingsRoot.model_validate(
        {
            "schema_version": "2.0",
            "paths": {
                "pdf_input_dir": "/tmp/input",
                "docx_output_dir": "/tmp/output/docx",
                "json_output_dir": "/tmp/output/json",
                "master_json_path": "/tmp/output/master.json",
                "ocr_cache_dir": "/tmp/cache/ocr",
                "grounding_cache_path": "/tmp/cache/grounding.json",
                "prompt_md_dir": "/tmp/prompts",
                "renderer_script": "/tmp/render-report.js",
                "data_temp_dir": "/tmp/data",
                "cowork_bus_dir": "/tmp/cowork-bus",
            },
            "filesystem": {
                "delete_requires_confirm": True,
                "delete_log_path": "/tmp/logs/delete.log",
                "allow_delete_outside_paths": False,
            },
            "pipeline": {
                "stage1_workers": 2,
                "stage1_ocr_engine": "paddleocr",
                "review_gates": {
                    "after_stage1": True,
                    "after_stage2": True,
                    "after_stage3": False,
                },
                "auto_advance_if_no_issue": True,
            },
            "ai_providers": {
                "default": "anthropic",
                "anthropic": {
                    "enabled": True,
                    "model": "claude-sonnet-4-6",
                    "api_key": "anthropic-secret-key",
                    "auth_token": "anthropic-secret-token",
                    "base_url": "https://api.anthropic.com",
                    "max_tokens": 16000,
                    "temperature": 0.2,
                    "timeout_seconds": 30,
                },
                "openai": {
                    "enabled": False,
                    "model": "gpt-4.1",
                    "api_key": "openai-secret-key",
                    "base_url": "https://api.openai.com/v1",
                    "timeout_seconds": 45,
                },
                "gemini": {
                    "enabled": True,
                    "model": "gemini-2.5-pro",
                    "api_key": "gemini-secret-key",
                    "base_url": "https://generativelanguage.googleapis.com",
                    "timeout_seconds": 60,
                },
            },
            "stage2": {
                "default_mode": "llm",
                "remember_per_hsba": True,
            },
            "cowork_bridge": {
                "default_method": "file_bus",
                "file_bus": {
                    "outbox_subdir": "outbox",
                    "inbox_subdir": "inbox",
                    "watch_inbox": True,
                },
                "clipboard": {
                    "auto_copy_prompt": True,
                    "auto_paste_result": False,
                },
                "paste_dialog": {
                    "show_full_prompt": True,
                },
            },
            "prompts": {
                "active_template": "prompt-c",
                "templates": [
                    {
                        "id": "prompt-a",
                        "label": "Prepare grounding sweep",
                        "source_file": "/tmp/prompts/PROMPTS-CLI.md",
                        "section_anchor": "# Prompt A",
                        "stage": "stage1",
                    },
                    {
                        "id": "prompt-c",
                        "label": "Analyze HSBA batch",
                        "source_file": "/tmp/prompts/PROMPTS-CLI.md",
                        "section_anchor": "# Prompt C",
                        "stage": "stage2",
                    },
                ],
                "meta_prompt_template": "/tmp/prompts/meta.md",
            },
            "ui": {
                "theme": "system",
                "language": "vi",
                "density": "compact",
                "show_phi_warning_on_first_open": True,
            },
            "telemetry": {
                "enabled": False,
                "send_errors": False,
                "send_usage": True,
            },
        }
    )


def test_settings_store_uses_default_config_path() -> None:
    store = SettingsStore(encryption_key=Fernet.generate_key())

    assert store.settings_path == Path.home() / ".config" / "emr-analyzer" / "settings.json"


def test_settings_store_encrypts_secrets_and_loads_plaintext(tmp_path: Path) -> None:
    key = Fernet.generate_key()
    store = SettingsStore(config_dir=tmp_path, encryption_key=key)
    settings = build_settings()

    store.save(settings)

    raw_text = store.settings_path.read_text(encoding="utf-8")
    raw_json = json.loads(raw_text)

    assert "anthropic-secret-key" not in raw_text
    assert "anthropic-secret-token" not in raw_text
    assert "openai-secret-key" not in raw_text
    assert "gemini-secret-key" not in raw_text
    assert raw_json["ai_providers"]["anthropic"]["api_key"].startswith("fernet:")
    assert raw_json["ai_providers"]["anthropic"]["auth_token"].startswith("fernet:")
    assert raw_json["ai_providers"]["openai"]["api_key"].startswith("fernet:")
    assert raw_json["ai_providers"]["gemini"]["api_key"].startswith("fernet:")

    loaded = store.load()

    assert loaded.ai_providers.anthropic.api_key == "anthropic-secret-key"
    assert loaded.ai_providers.anthropic.auth_token == "anthropic-secret-token"
    assert loaded.ai_providers.openai.api_key == "openai-secret-key"
    assert loaded.ai_providers.gemini.api_key == "gemini-secret-key"


def test_settings_store_masks_secrets_for_api_output(tmp_path: Path) -> None:
    key = Fernet.generate_key()
    store = SettingsStore(config_dir=tmp_path, encryption_key=key)
    settings = build_settings()
    store.save(settings)

    safe = store.to_api_safe_dict()

    assert safe["ai_providers"]["anthropic"]["api_key"] == "***MASKED***"
    assert safe["ai_providers"]["anthropic"]["auth_token"] == "***MASKED***"
    assert safe["ai_providers"]["openai"]["api_key"] == "***MASKED***"
    assert safe["ai_providers"]["gemini"]["api_key"] == "***MASKED***"
    assert safe["schema_version"] == "2.0"


def test_settings_contracts_match_spec_nested_fields() -> None:
    settings = build_settings()

    assert settings.paths.pdf_input_dir == "/tmp/input"
    assert settings.paths.docx_output_dir == "/tmp/output/docx"
    assert settings.paths.json_output_dir == "/tmp/output/json"
    assert settings.paths.master_json_path == "/tmp/output/master.json"
    assert settings.paths.ocr_cache_dir == "/tmp/cache/ocr"
    assert settings.paths.grounding_cache_path == "/tmp/cache/grounding.json"
    assert settings.paths.prompt_md_dir == "/tmp/prompts"
    assert settings.paths.renderer_script == "/tmp/render-report.js"
    assert settings.paths.data_temp_dir == "/tmp/data"
    assert settings.paths.cowork_bus_dir == "/tmp/cowork-bus"

    assert settings.filesystem.delete_requires_confirm is True
    assert settings.filesystem.delete_log_path == "/tmp/logs/delete.log"
    assert settings.filesystem.allow_delete_outside_paths is False

    assert settings.pipeline.stage1_workers == 2
    assert settings.pipeline.stage1_ocr_engine == "paddleocr"
    assert settings.pipeline.review_gates.after_stage1 is True
    assert settings.pipeline.review_gates.after_stage2 is True
    assert settings.pipeline.review_gates.after_stage3 is False
    assert settings.pipeline.auto_advance_if_no_issue is True

    assert settings.ai_providers.default == "anthropic"
    assert settings.ai_providers.anthropic.model == "claude-sonnet-4-6"
    assert settings.ai_providers.anthropic.auth_token == "anthropic-secret-token"
    assert settings.ai_providers.anthropic.max_tokens == 16000
    assert settings.ai_providers.anthropic.temperature == 0.2
    assert settings.ai_providers.openai.model == "gpt-4.1"
    assert settings.ai_providers.gemini.model == "gemini-2.5-pro"

    assert settings.stage2.default_mode == Stage2Mode.llm
    assert settings.stage2.remember_per_hsba is True

    assert settings.cowork_bridge.default_method == "file_bus"
    assert settings.cowork_bridge.file_bus.outbox_subdir == "outbox"
    assert settings.cowork_bridge.file_bus.inbox_subdir == "inbox"
    assert settings.cowork_bridge.file_bus.watch_inbox is True
    assert settings.cowork_bridge.clipboard.auto_copy_prompt is True
    assert settings.cowork_bridge.clipboard.auto_paste_result is False
    assert settings.cowork_bridge.paste_dialog.show_full_prompt is True

    assert settings.prompts.active_template == "prompt-c"
    assert len(settings.prompts.templates) == 2
    assert settings.prompts.templates[0].id == "prompt-a"
    assert settings.prompts.templates[0].label == "Prepare grounding sweep"
    assert settings.prompts.templates[0].source_file == "/tmp/prompts/PROMPTS-CLI.md"
    assert settings.prompts.templates[0].section_anchor == "# Prompt A"
    assert settings.prompts.templates[0].stage == "stage1"
    assert settings.prompts.meta_prompt_template == "/tmp/prompts/meta.md"

    assert settings.ui.theme == "system"
    assert settings.ui.language == "vi"
    assert settings.ui.density == "compact"
    assert settings.ui.show_phi_warning_on_first_open is True

    assert settings.telemetry.enabled is False
    assert settings.telemetry.send_errors is False
    assert settings.telemetry.send_usage is True
