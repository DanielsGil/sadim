"""
HU-045 — mecanismo común de idempotencia por operation_id (Contrato API v2
§2 y §13.1, P-03).

Toda escritura en línea que incluya operation_id se registra en
OperacionSincronizacion, en la misma transacción que sus propios efectos.
Si el operation_id ya existe, no se repiten los efectos y se responde con el
mismo código HTTP de la primera vez: el estado actual del objeto si fue
exitosa, o el mismo error si fue rechazada.

Bloque 5a (HU-032, Contrato v2 §13.1): el mismo núcleo (`_registrar_y_ejecutar`)
lo reutiliza `ejecutar_operacion_sync` para /api/sync/, que registra
origen=SINCRONIZACION, dispositivo y payload, y responde con el sobre
{estado, objeto_id, ...} del Contrato en vez de repetir el código HTTP.
"""

import uuid
from decimal import InvalidOperation

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.settings import api_settings

from .exceptions import ErrorNegocio
from .models import OperacionSincronizacion


def _registrar_y_ejecutar(*, operation_id, usuario, recurso, accion, ejecutar,
                           dispositivo=None, origen=OperacionSincronizacion.Origen.EN_LINEA,
                           fecha_cliente=None, payload=None, objeto_id_si_falla=None):
    """
    Núcleo común: busca operation_id; si no existe, ejecuta la operación en
    una sub-transacción (savepoint) y registra el resultado en
    OperacionSincronizacion, todo dentro de una transacción atómica exterior.

    ejecutar() puede levantar ErrorNegocio (rechazo o conflicto de negocio) o
    rest_framework.exceptions.ValidationError (rechazo de forma, cuando
    reutiliza un serializer existente, p. ej. categorías/productos en sync) —
    ambas se tratan como el mismo tipo de fallo de aquí en adelante.

    Devuelve (registro, error, objeto_id, datos_respuesta, status_code):
    - registro != None ⇒ operation_id ya se había procesado antes; el
      llamador decide cómo responder (online repite el resultado; sync
      responde DUPLICADA).
    - registro is None ⇒ se procesó ahora; error es None si tuvo éxito.
    """
    registro = OperacionSincronizacion.objects.filter(operation_id=operation_id).first()
    if registro is not None:
        return registro, None, None, None, None

    try:
        with transaction.atomic():
            error = None
            objeto_id = datos_respuesta = status_code = None
            try:
                # Sub-transacción (savepoint): si "ejecutar" falla, sus
                # efectos se revierten solos, pero la transacción exterior
                # sigue abierta para poder registrar el rechazo.
                with transaction.atomic():
                    objeto_id, datos_respuesta, status_code = ejecutar()
            except ErrorNegocio as exc:
                error = exc
                status_code = exc.status_code
                objeto_id = objeto_id_si_falla
            except DRFValidationError as exc:
                detalle = exc.detail
                details = detalle if isinstance(detalle, dict) else {'errores': detalle}
                error = ErrorNegocio(
                    code='DATOS_INVALIDOS',
                    message='Los datos enviados no son válidos.',
                    status_code=400,
                    details=details,
                )
                status_code = 400
                objeto_id = objeto_id_si_falla
            except (KeyError, TypeError, ValueError, InvalidOperation) as exc:
                # Bloque 5a (HU-032): un payload de /api/sync/ mal formado
                # (campo obligatorio ausente, un valor con el tipo incorrecto)
                # se rechaza como DATOS_INVALIDOS de esa operación, sin
                # abortar el resto del lote ni devolver un 500 genérico.
                error = ErrorNegocio(
                    code='DATOS_INVALIDOS',
                    message=f'El payload de la operación no es válido: {exc}',
                    status_code=400,
                )
                status_code = 400
                objeto_id = objeto_id_si_falla

            OperacionSincronizacion.objects.create(
                operation_id=operation_id,
                dispositivo=dispositivo,
                usuario=usuario,
                recurso=recurso,
                accion=accion,
                origen=origen,
                estado=(
                    OperacionSincronizacion.Estado.APLICADA if error is None
                    else OperacionSincronizacion.Estado.CONFLICTO if error.status_code == 409
                    else OperacionSincronizacion.Estado.RECHAZADA
                ),
                objeto_id=objeto_id,
                codigo_conflicto=error.code if error else None,
                mensaje=error.message if error else None,
                payload=payload,
                status_code_original=status_code,
                # P-03 / Contrato v2 §17: en línea, fecha_cliente es la fecha
                # de recepción, porque no hay un dispositivo offline de origen.
                fecha_cliente=fecha_cliente or timezone.now(),
            )
    except IntegrityError:
        # Dos peticiones simultáneas con el mismo operation_id: la que pierde
        # la carrera revierte todos sus efectos (incluido su propio intento
        # de registro) y repite el resultado que dejó la ganadora.
        registro = OperacionSincronizacion.objects.get(operation_id=operation_id)
        return registro, None, None, None, None

    return None, error, objeto_id, datos_respuesta, status_code


def ejecutar_con_idempotencia(*, operation_id, usuario, recurso, accion, ejecutar, obtener_estado_actual):
    """
    - ejecutar(): corre la operación (crear la fila, cerrar la venta, cambiar
      el estado, etc.) y devuelve (objeto_id, datos_respuesta, status_code).
      Puede levantar ErrorNegocio; en ese caso no se aplica ningún efecto.
    - obtener_estado_actual(objeto_id): reconstruye la respuesta de éxito a
      partir del estado actual del objeto, para cuando se repite la petición.

    Devuelve (datos_respuesta, status_code).
    """
    registro, error, _objeto_id, datos_respuesta, status_code = _registrar_y_ejecutar(
        operation_id=operation_id, usuario=usuario, recurso=recurso, accion=accion, ejecutar=ejecutar,
    )
    if registro is not None:
        return _repetir_resultado(registro, obtener_estado_actual)

    if error:
        raise error
    return datos_respuesta, status_code


def ejecutar_operacion_sync(*, operation_id, usuario, dispositivo, recurso, accion, fecha_cliente,
                             payload, ejecutar, objeto_id_si_falla=None):
    """
    Bloque 5a (HU-032): equivalente de ejecutar_con_idempotencia para
    /api/sync/. En vez de repetir el código HTTP original o lanzar el error,
    arma el resultado por operación que pide el Contrato v2 §13:
    {"operation_id", "estado", "objeto_id", ["codigo_conflicto", "mensaje"]}.
    Un reintento responde estado=DUPLICADA con estado_original (Contrato
    v2 §13.1), en vez de repetir la respuesta como hace la vía en línea.
    """
    registro, error, objeto_id, _datos, _status = _registrar_y_ejecutar(
        operation_id=operation_id, usuario=usuario, recurso=recurso, accion=accion, ejecutar=ejecutar,
        dispositivo=dispositivo, origen=OperacionSincronizacion.Origen.SINCRONIZACION,
        fecha_cliente=fecha_cliente, payload=payload, objeto_id_si_falla=objeto_id_si_falla,
    )

    if registro is not None:
        resultado = {
            'operation_id': str(operation_id),
            'estado': OperacionSincronizacion.Estado.DUPLICADA,
            'estado_original': registro.estado,
            'objeto_id': str(registro.objeto_id) if registro.objeto_id else None,
        }
        if registro.estado in (OperacionSincronizacion.Estado.RECHAZADA, OperacionSincronizacion.Estado.CONFLICTO):
            resultado['codigo_conflicto'] = registro.codigo_conflicto
            resultado['mensaje'] = registro.mensaje
        return resultado

    if error:
        return {
            'operation_id': str(operation_id),
            'estado': (
                OperacionSincronizacion.Estado.CONFLICTO if error.status_code == 409
                else OperacionSincronizacion.Estado.RECHAZADA
            ),
            'codigo_conflicto': error.code,
            'mensaje': error.message,
            'objeto_id': str(objeto_id) if objeto_id else None,
        }

    return {
        'operation_id': str(operation_id),
        'estado': OperacionSincronizacion.Estado.APLICADA,
        'objeto_id': str(objeto_id) if objeto_id else None,
    }


def _repetir_resultado(registro, obtener_estado_actual):
    if registro.estado == OperacionSincronizacion.Estado.APLICADA:
        return obtener_estado_actual(registro.objeto_id), registro.status_code_original

    raise ErrorNegocio(
        code=registro.codigo_conflicto,
        message=registro.mensaje,
        status_code=registro.status_code_original,
    )


class CreacionIdempotenteMixin:
    """
    HU-045: create() idempotente por operation_id, reutilizable por cualquier
    ViewSet de creación en línea. Cada ViewSet solo declara `recurso_sync`
    (por ejemplo "categorias" o "productos"); el modelo debe tener un campo
    operation_id.
    """

    recurso_sync = None

    def get_success_headers(self, data):
        # Copiado de rest_framework.mixins.CreateModelMixin: no se hereda de
        # ese mixin porque su create() no es idempotente.
        try:
            return {'Location': str(data[api_settings.URL_FIELD_NAME])}
        except (TypeError, KeyError):
            return {}

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operation_id = serializer.validated_data.pop('operation_id', None) or uuid.uuid4()
        modelo = self.queryset.model

        def _ejecutar():
            instancia = serializer.save(operation_id=operation_id)
            return instancia.pk, self.get_serializer(instancia).data, 201

        def _estado_actual(objeto_id):
            return self.get_serializer(modelo.objects.get(pk=objeto_id)).data

        datos, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso=self.recurso_sync,
            accion=OperacionSincronizacion.Accion.CREATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        headers = self.get_success_headers(datos)
        return Response(datos, status=status_code, headers=headers)
