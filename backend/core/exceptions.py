"""
Manejo de errores de SADIM (Contrato API §14, IMP-07).

Toda respuesta de error de la API tiene la forma {"code", "message", "details"},
sin importar si el error viene de una regla de negocio, de una validación de
DRF o de una excepción no controlada. Los códigos y estados HTTP siguen la
tabla del Contrato §14 y las decisiones D1/D2 acordadas para el cierre del
Sprint 2.
"""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions as drf_exceptions
from rest_framework.response import Response
from rest_framework.views import set_rollback


class ErrorNegocio(Exception):
    """
    Excepción de negocio reutilizable: código, mensaje, estado HTTP y detalles
    del Contrato API §14. Los módulos de Sprint 3 la reutilizan para sus
    propios códigos (STOCK_INSUFICIENTE, VENTA_YA_CERRADA, etc.) sin tener que
    definir su propio formato de error.
    """

    def __init__(self, code, message, status_code=400, details=None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


def _respuesta_error(code, message, status_code, details=None):
    set_rollback()
    return Response(
        {'code': code, 'message': message, 'details': details or {}},
        status=status_code,
    )


def manejador_de_excepciones(exc, context):
    """EXCEPTION_HANDLER de DRF: convierte cualquier excepción en {code, message, details}."""

    if isinstance(exc, ErrorNegocio):
        return _respuesta_error(exc.code, exc.message, exc.status_code, exc.details)

    # DRF solo traduce Http404 / PermissionDenied (de Django, no de DRF) a sus
    # equivalentes de APIException dentro de su exception_handler por
    # defecto; como este lo reemplaza por completo, hay que repetir esa
    # traducción aquí (si no, get_object_or_404 termina en ERROR_INTERNO 500
    # en vez de 404).
    if isinstance(exc, Http404):
        exc = drf_exceptions.NotFound(*exc.args)
    elif isinstance(exc, DjangoPermissionDenied):
        exc = drf_exceptions.PermissionDenied(*exc.args)

    if isinstance(exc, drf_exceptions.NotAuthenticated):
        return _respuesta_error(
            'NO_AUTENTICADO',
            'Se requiere autenticación para realizar esta operación.',
            401,
        )

    if isinstance(exc, drf_exceptions.AuthenticationFailed):
        return _respuesta_error(
            'NO_AUTENTICADO',
            'Las credenciales de autenticación no son válidas o expiraron.',
            401,
        )

    if isinstance(exc, drf_exceptions.PermissionDenied):
        return _respuesta_error(
            'PERMISO_INSUFICIENTE',
            'No tiene permisos suficientes para realizar esta operación.',
            403,
        )

    if isinstance(exc, drf_exceptions.NotFound):
        return _respuesta_error(
            'RECURSO_NO_ENCONTRADO',
            'El recurso solicitado no existe.',
            404,
        )

    if isinstance(exc, drf_exceptions.MethodNotAllowed):
        return _respuesta_error(
            'METODO_NO_PERMITIDO',
            'El método HTTP utilizado no está permitido para este recurso.',
            405,
        )

    if isinstance(exc, drf_exceptions.ValidationError):
        detalle = exc.detail
        details = detalle if isinstance(detalle, dict) else {'errores': detalle}
        return _respuesta_error(
            'DATOS_INVALIDOS',
            'Los datos enviados no son válidos.',
            400,
            details,
        )

    if isinstance(exc, drf_exceptions.ParseError):
        return _respuesta_error(
            'DATOS_INVALIDOS',
            'El cuerpo de la solicitud no tiene un formato válido.',
            400,
        )

    if isinstance(exc, drf_exceptions.APIException):
        # Catch-all para el resto de APIException de DRF (Throttled, UnsupportedMediaType, etc.).
        return _respuesta_error(
            'DATOS_INVALIDOS' if exc.status_code < 500 else 'ERROR_INTERNO',
            str(exc.detail),
            exc.status_code,
        )

    # Excepción no controlada (bug, error de BD, etc.): nunca se exponen detalles internos.
    return _respuesta_error(
        'ERROR_INTERNO',
        'Ocurrió un error inesperado en el servidor.',
        500,
    )
