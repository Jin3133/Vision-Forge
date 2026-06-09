class VisionForgeError(Exception):
    def __init__(self, message: str, code: str = None, details: dict = None):
        self.message = message
        self.code = code
        self.details = details
        super().__init__(message)

    def __str__(self):
        return self.message


class LLMServiceError(VisionForgeError):
    def __init__(self, message: str, provider: str = "", code: str = None, details: dict = None):
        self.provider = provider
        super().__init__(message, code=code, details=details)


class LLMRateLimitError(LLMServiceError):
    pass


class LLMTimeoutError(LLMServiceError):
    pass


class DocumentParseError(VisionForgeError):
    pass


class UnsupportedFileTypeError(DocumentParseError):
    pass


class ParseTimeoutError(DocumentParseError):
    pass


class MinerUApiError(DocumentParseError):
    pass


class MinerURateLimitError(MinerUApiError):
    pass


class MinerUTimeoutError(MinerUApiError):
    pass


class ReportGenerationError(VisionForgeError):
    pass


class AnimationGenerationError(VisionForgeError):
    pass


class ConfigurationError(VisionForgeError):
    def __init__(self, message: str, missing_keys: list = None, code: str = None, details: dict = None):
        self.missing_keys = missing_keys or []
        super().__init__(message, code=code, details=details)
