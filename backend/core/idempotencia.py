"""
HU-045 — mecanismo común de idempotencia por operation_id (Contrato API v2
§2 y §13.1, P-03).

Toda escritura en línea que incluya operation_id se registra en
OperacionSincronizacion, en la misma transacción que sus propios efectos.
Si el operation_id ya existe, no se repiten los efectos y se responde con el
mismo código HTTP de la primera vez: el estado actual del objeto si fue
exitosa, o el mismo error si fue rechazada.
"""

import uuid

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.settings import api_settings

from .exceptions import ErrorNegocio
from .models import OperacionSincronizacion


def ejecutar_con_idempotencia(*, operation_id, usuario, recurso, accion, ejecutar, obtener_estado_actual):
    """
    - ejecutar(): corre la operación (crear la fila, cerrar la venta, cambiar
      el estado, etc.) y devuelve (objeto_id, datos_respuesta, status_code).
      Puede levantar ErrorNegocio; en ese caso no se aplica ningún efecto.
    - obtener_estado_actual(objeto_id): reconstruye la respuesta de éxito a
      partir del estado actual del objeto, para cuando se repite la petición.

    Devuelve (datos_respuesta, status_code).
    """
    registro = OperacionSincronizacion.objects.filter(operation_id=operation_id).first()
    if registro is not None:
        return _repetir_resultado(registro, obtener_estado_actual)

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

            OperacionSincronizacion.objects.create(
                operation_id=operation_id,
                dispositivo=None,
                usuario=usuario,
                recurso=recurso,
                accion=accion,
                origen=OperacionSincronizacion.Origen.EN_LINEA,
                estado=(
                    OperacionSincronizacion.Estado.APLICADA if error is None
                    else OperacionSincronizacion.Estado.CONFLICTO if error.status_code == 409
                    else OperacionSincronizacion.Estado.RECHAZADA
                ),
                objeto_id=objeto_id,
                codigo_conflicto=error.code if error else None,
                mensaje=error.message if error else None,
                status_code_original=status_code,
                # P-03 / Contrato v2 §17: en línea, fecha_cliente es la fecha
                # de recepción, porque no hay un dispositivo offline de origen.
                fecha_cliente=timezone.now(),
            )
    except IntegrityError:
        # Dos peticiones simultáneas con el mismo operation_id: la que pierde
        # la carrera revierte todos sus efectos (incluido su propio intento
        # de registro) y repite el resultado que dejó la ganadora.
        registro = OperacionSincronizacion.objects.get(operation_id=operation_id)
        return _repetir_resultado(registro, obtener_estado_actual)

    if error:
        raise error
    return datos_respuesta, status_code


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
