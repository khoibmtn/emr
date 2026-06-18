from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class EMRBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FlexibleMetadataModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class JobState(StrEnum):
    received = "RECEIVED"
    s1_parsing = "S1_PARSING"
    s1_ocr = "S1_OCR"
    s1_done = "S1_DONE"
    s2_pending = "S2_PENDING"
    s2_llm_run = "S2_LLM_RUN"
    s2_cowork_out = "S2_COWORK_OUT"
    s2_manual = "S2_MANUAL"
    s2_done = "S2_DONE"
    s3_rendering = "S3_RENDERING"
    completed = "COMPLETED"
    failed = "FAILED"
    # Legacy-friendly values accepted during early bootstrap/tests.
    queued = "queued"
    stage1_running = "stage1_running"
    stage2_running = "stage2_running"
    stage3_running = "stage3_running"


class Stage2Mode(StrEnum):
    llm = "llm"
    cowork = "cowork"
    manual = "manual"


class PathsConfig(EMRBaseModel):
    pdf_input_dir: str
    docx_output_dir: str
    json_output_dir: str
    master_json_path: str
    ocr_cache_dir: str
    grounding_cache_path: str
    prompt_md_dir: str
    renderer_script: str
    data_temp_dir: str
    cowork_bus_dir: str


class FilesystemConfig(EMRBaseModel):
    delete_requires_confirm: bool = True
    delete_log_path: str
    allow_delete_outside_paths: bool = False


class ReviewGatesConfig(EMRBaseModel):
    after_stage1: bool = True
    after_stage2: bool = True
    after_stage3: bool = False


class PipelineConfig(EMRBaseModel):
    stage1_workers: int = Field(default=1, ge=1)
    stage1_ocr_engine: str = "paddleocr"
    review_gates: ReviewGatesConfig
    auto_advance_if_no_issue: bool = True


class ProviderConfig(EMRBaseModel):
    enabled: bool = False
    base_url: str | None = None
    api_key: str | None = None
    auth_token: str | None = None
    model: str | None = None
    max_tokens: int | None = Field(default=None, ge=1)
    temperature: float | None = None
    timeout_seconds: int = Field(default=30, ge=1)


class AIProvidersConfig(EMRBaseModel):
    default: str
    anthropic: ProviderConfig
    openai: ProviderConfig
    gemini: ProviderConfig


class Stage2Config(EMRBaseModel):
    default_mode: Stage2Mode = Stage2Mode.llm
    remember_per_hsba: bool = True


class FileBusConfig(EMRBaseModel):
    outbox_subdir: str
    inbox_subdir: str
    watch_inbox: bool = True


class ClipboardConfig(EMRBaseModel):
    auto_copy_prompt: bool = True
    auto_paste_result: bool = False


class PasteDialogConfig(EMRBaseModel):
    show_full_prompt: bool = True


class CoworkBridgeConfig(EMRBaseModel):
    default_method: str
    file_bus: FileBusConfig
    clipboard: ClipboardConfig
    paste_dialog: PasteDialogConfig


class PromptTemplateConfig(EMRBaseModel):
    id: str
    label: str
    source_file: str
    section_anchor: str
    stage: str


class PromptsConfig(EMRBaseModel):
    active_template: str
    templates: list[PromptTemplateConfig] = Field(default_factory=list)
    meta_prompt_template: str


class UIConfig(EMRBaseModel):
    theme: str = "system"
    language: str = "vi"
    density: str = "comfortable"
    show_phi_warning_on_first_open: bool = True


class TelemetryConfig(EMRBaseModel):
    enabled: bool = False
    send_errors: bool = False
    send_usage: bool = False


class SettingsRoot(EMRBaseModel):
    schema_version: str
    paths: PathsConfig
    filesystem: FilesystemConfig
    pipeline: PipelineConfig
    ai_providers: AIProvidersConfig
    stage2: Stage2Config
    cowork_bridge: CoworkBridgeConfig
    prompts: PromptsConfig
    ui: UIConfig
    telemetry: TelemetryConfig


class OCRProgressMeta(FlexibleMetadataModel):
    pending: list[int] = Field(default_factory=list)
    completed: list[int] = Field(default_factory=list)
    failed: list[int] = Field(default_factory=list)


class Stage1Meta(FlexibleMetadataModel):
    pages: int | None = None
    ocr: OCRProgressMeta | None = None


class GroundingMeta(FlexibleMetadataModel):
    hit: bool | None = None


class Stage2Meta(FlexibleMetadataModel):
    grounding: GroundingMeta | None = None
    notes: list[str] = Field(default_factory=list)
    citations: int | None = None


class Stage3Meta(FlexibleMetadataModel):
    docx: str | None = None
    json_output: str | None = None
    master_json_updated: bool | None = None


def utc_now() -> datetime:
    return datetime.now(UTC)


class JobRecord(EMRBaseModel):
    ma_kcb: str
    pdf_path: str
    state: JobState = JobState.received
    stage1_meta: Stage1Meta = Field(default_factory=Stage1Meta)
    stage2_mode: Stage2Mode = Stage2Mode.llm
    stage2_meta: Stage2Meta = Field(default_factory=Stage2Meta)
    stage3_meta: Stage3Meta = Field(default_factory=Stage3Meta)
    error_log: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class JobUpdate(EMRBaseModel):
    pdf_path: str | None = None
    state: JobState | None = None
    stage1_meta: Stage1Meta | None = None
    stage2_mode: Stage2Mode | None = None
    stage2_meta: Stage2Meta | None = None
    stage3_meta: Stage3Meta | None = None
    error_log: list[str] | None = None
