import uuid
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import ConfiguracionModulo, ConfiguracionPago
from finanzas.models import MovimientoCaja
from inventario.models import Categoria, MovimientoInventario, Producto
from usuarios.models import Usuario

from .models import Abono, ConsumoOrden, CostoOperativoOrden, OrdenTrabajo

PASSWORD = 'ClaveSegura2026!'


def assert_error_shape(test, response):
    test.assertEqual(set(response.data.keys()), {'code', 'message', 'details'})


class ServiciosAPITestCase(TestCase):
    """Base común: ADMIN y OPERADOR autenticados, configuración y catálogo de prueba."""

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username='admin1', password=PASSWORD, nombre_completo='Admin Uno', rol='ADMIN',
        )
        self.operador = Usuario.objects.create_user(
            username='oper1', password=PASSWORD, nombre_completo='Operador Uno', rol='OPERADOR',
        )
        ConfiguracionModulo.objects.create(actualizado_por=self.admin, actualizado_en=timezone.now())
        ConfiguracionPago.objects.create(
            actualizado_por=self.admin, actualizado_en=timezone.now(),
            acepta_efectivo=True, acepta_transferencia=True, acepta_qr=True,
            nequi_titular='Aroma & Co.', nequi_llave='3001234567',
        )

        self.categoria = Categoria.objects.create(nombre='Insumos')
        self.harina = Producto.objects.create(
            categoria=self.categoria, nombre='Harina', tipo='INSUMO_PRODUCCION',
            precio_venta=Decimal('0.00'), unidad_medida='kg',
            controla_stock=True, stock_actual=Decimal('10'),
        )
        self.decoracion = Producto.objects.create(
            categoria=self.categoria, nombre='Decoración personalizada', tipo='INSUMO_PRODUCCION',
            precio_venta=Decimal('0.00'), unidad_medida='unidad',
            controla_stock=False,
        )

        self.c_admin = APIClient()
        self._autenticar(self.c_admin, 'admin1')
        self.c_operador = APIClient()
        self._autenticar(self.c_operador, 'oper1')
        self.c_anonimo = APIClient()

    def _autenticar(self, client, username):
        response = client.post(
            '/api/auth/login/', {'username': username, 'password': PASSWORD}, format='json',
        )
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access_token']}")

    def _crear_orden(self, cliente=None, **overrides):
        cliente = cliente or self.c_admin
        payload = {
            'operation_id': str(uuid.uuid4()),
            'cliente_nombre': 'Laura Méndez',
            'cliente_telefono': '3104567890',
            'descripcion': 'Torta de chocolate para 20 personas',
            'fecha_entrega_estimada': '2026-09-25',
            'costo_total': '75000.00',
        }
        payload.update(overrides)
        return cliente.post('/api/ordenes-trabajo/', payload, format='json')


class RegistrarOrdenTests(ServiciosAPITestCase):
    """HU-020 — POST /api/ordenes-trabajo/ (CU-06)."""

    def test_camino_feliz(self):
        response = self._crear_orden()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['estado'], 'RECIBIDO')
        self.assertEqual(Decimal(str(response.data['saldo_pendiente'])), Decimal('75000.00'))
        self.assertEqual(Decimal(str(response.data['utilidad_neta'])), Decimal('75000.00'))

    def test_operador_no_ve_utilidad_neta(self):
        response = self._crear_orden(cliente=self.c_operador)
        self.assertEqual(response.status_code, 201)
        self.assertNotIn('utilidad_neta', response.data)

    def test_costo_total_negativo_responde_400(self):
        response = self._crear_orden(costo_total='-10.00')
        self.assertEqual(response.status_code, 400)
        assert_error_shape(self, response)

    def test_anonimo_recibe_401(self):
        response = self.c_anonimo.post('/api/ordenes-trabajo/', {}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_reintento_con_mismo_operation_id_no_duplica(self):
        payload = {
            'operation_id': str(uuid.uuid4()),
            'cliente_nombre': 'Laura Méndez',
            'descripcion': 'Torta',
            'fecha_entrega_estimada': '2026-09-25',
            'costo_total': '75000.00',
        }
        primera = self.c_admin.post('/api/ordenes-trabajo/', payload, format='json')
        segunda = self.c_admin.post('/api/ordenes-trabajo/', payload, format='json')
        self.assertEqual(primera.status_code, 201)
        self.assertEqual(segunda.status_code, 201)
        self.assertEqual(primera.data['id'], segunda.data['id'])
        self.assertEqual(OrdenTrabajo.objects.count(), 1)


class DetalleOrdenTests(ServiciosAPITestCase):
    """D13 — GET /api/ordenes-trabajo/{id}/."""

    def test_detalle_incluye_abonos_y_saldo(self):
        orden_id = self._crear_orden().data['id']
        self.c_admin.post(
            f'/api/ordenes-trabajo/{orden_id}/abonos/',
            {'operation_id': str(uuid.uuid4()), 'valor': '20000.00', 'medio_pago': 'EFECTIVO'},
            format='json',
        )
        response = self.c_operador.get(f'/api/ordenes-trabajo/{orden_id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['abonos']), 1)
        self.assertEqual(Decimal(str(response.data['saldo_pendiente'])), Decimal('55000.00'))
        self.assertNotIn('utilidad_neta', response.data)


class CambiarEstadoTests(ServiciosAPITestCase):
    """HU-021 — PATCH /api/ordenes-trabajo/{id}/estado/ (CU-07)."""

    def _avanzar(self, orden_id, estado, cliente=None, operation_id=None):
        cliente = cliente or self.c_admin
        return cliente.patch(
            f'/api/ordenes-trabajo/{orden_id}/estado/',
            {'operation_id': operation_id or str(uuid.uuid4()), 'estado': estado},
            format='json',
        )

    def test_avanza_al_estado_siguiente(self):
        orden_id = self._crear_orden().data['id']
        response = self._avanzar(orden_id, 'EN_PROCESO')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['estado'], 'EN_PROCESO')

    def test_saltar_estado_responde_400(self):
        orden_id = self._crear_orden().data['id']
        response = self._avanzar(orden_id, 'LISTO')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')

    def test_retroceder_estado_responde_400(self):
        orden_id = self._crear_orden().data['id']
        self._avanzar(orden_id, 'EN_PROCESO')
        response = self._avanzar(orden_id, 'RECIBIDO')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')

    def test_entrega_descuenta_stock_de_consumos_pendientes(self):
        orden_id = self._crear_orden().data['id']
        self.c_admin.post(
            f'/api/ordenes-trabajo/{orden_id}/consumos/',
            {'operation_id': str(uuid.uuid4()), 'producto_id': str(self.harina.id), 'cantidad': '3'},
            format='json',
        )
        self.c_admin.post(
            f'/api/ordenes-trabajo/{orden_id}/consumos/',
            {'operation_id': str(uuid.uuid4()), 'producto_id': str(self.decoracion.id), 'cantidad': '1'},
            format='json',
        )
        self._avanzar(orden_id, 'EN_PROCESO')
        self._avanzar(orden_id, 'LISTO')
        response = self._avanzar(orden_id, 'ENTREGADO')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['estado'], 'ENTREGADO')

        self.harina.refresh_from_db()
        self.assertEqual(self.harina.stock_actual, Decimal('7'))
        self.assertEqual(
            MovimientoInventario.objects.filter(producto=self.harina, tipo='SALIDA_SERVICIO').count(), 1,
        )
        self.assertEqual(
            MovimientoInventario.objects.filter(producto=self.decoracion).count(), 0,
        )
        consumos = ConsumoOrden.objects.filter(orden_id=orden_id)
        self.assertTrue(all(c.estado == 'APLICADO' for c in consumos))

    def test_entrega_sin_existencias_no_aplica_nada_y_queda_en_listo(self):
        orden_id = self._crear_orden().data['id']
        self.c_admin.post(
            f'/api/ordenes-trabajo/{orden_id}/consumos/',
            {'operation_id': str(uuid.uuid4()), 'producto_id': str(self.harina.id), 'cantidad': '999'},
            format='json',
        )
        self._avanzar(orden_id, 'EN_PROCESO')
        self._avanzar(orden_id, 'LISTO')
        response = self._avanzar(orden_id, 'ENTREGADO')

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'STOCK_INSUFICIENTE')

        orden = OrdenTrabajo.objects.get(pk=orden_id)
        self.assertEqual(orden.estado, 'LISTO')
        self.harina.refresh_from_db()
        self.assertEqual(self.harina.stock_actual, Decimal('10'))
        self.assertEqual(ConsumoOrden.objects.get(orden_id=orden_id).estado, 'PENDIENTE')
        self.assertEqual(MovimientoInventario.objects.filter(producto=self.harina).count(), 0)

    def test_cambio_de_estado_sobre_entregado_responde_409(self):
        orden_id = self._crear_orden().data['id']
        self._avanzar(orden_id, 'EN_PROCESO')
        self._avanzar(orden_id, 'LISTO')
        self._avanzar(orden_id, 'ENTREGADO')
        response = self._avanzar(orden_id, 'ENTREGADO')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'ORDEN_YA_ENTREGADA')

    def test_reintento_de_entrega_con_mismo_operation_id_no_descuenta_dos_veces(self):
        orden_id = self._crear_orden().data['id']
        self.c_admin.post(
            f'/api/ordenes-trabajo/{orden_id}/consumos/',
            {'operation_id': str(uuid.uuid4()), 'producto_id': str(self.harina.id), 'cantidad': '3'},
            format='json',
        )
        self._avanzar(orden_id, 'EN_PROCESO')
        self._avanzar(orden_id, 'LISTO')
        operation_id = str(uuid.uuid4())
        primera = self._avanzar(orden_id, 'ENTREGADO', operation_id=operation_id)
        segunda = self._avanzar(orden_id, 'ENTREGADO', operation_id=operation_id)

        self.assertEqual(primera.status_code, 200)
        self.assertEqual(segunda.status_code, 200)
        self.harina.refresh_from_db()
        self.assertEqual(self.harina.stock_actual, Decimal('7'))
        self.assertEqual(
            MovimientoInventario.objects.filter(producto=self.harina, tipo='SALIDA_SERVICIO').count(), 1,
        )

    def test_anonimo_recibe_401(self):
        orden_id = self._crear_orden().data['id']
        response = self.c_anonimo.patch(
            f'/api/ordenes-trabajo/{orden_id}/estado/', {'estado': 'EN_PROCESO'}, format='json',
        )
        self.assertEqual(response.status_code, 401)


class AbonoTests(ServiciosAPITestCase):
    """HU-022 — POST /api/ordenes-trabajo/{id}/abonos/ (CU-08, R-12..R-14)."""

    def _abonar(self, orden_id, valor, medio_pago='EFECTIVO', cliente=None):
        cliente = cliente or self.c_admin
        return cliente.post(
            f'/api/ordenes-trabajo/{orden_id}/abonos/',
            {'operation_id': str(uuid.uuid4()), 'valor': valor, 'medio_pago': medio_pago},
            format='json',
        )

    def test_camino_feliz_actualiza_saldo_y_genera_movimiento_caja(self):
        orden_id = self._crear_orden().data['id']
        response = self._abonar(orden_id, '20000.00')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['estado_pago'], 'CONFIRMADO')
        self.assertEqual(Decimal(str(response.data['saldo_pendiente'])), Decimal('55000.00'))
        self.assertEqual(
            MovimientoCaja.objects.filter(abono_id=response.data['id'], tipo='INGRESO_ABONO').count(), 1,
        )

    def test_abono_con_transferencia_queda_pendiente_de_verificacion(self):
        orden_id = self._crear_orden().data['id']
        response = self._abonar(orden_id, '20000.00', medio_pago='TRANSFERENCIA')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['estado_pago'], 'PENDIENTE_VERIFICACION')
        movimiento = MovimientoCaja.objects.get(abono_id=response.data['id'])
        self.assertIsNone(movimiento.fecha_confirmacion)

    def test_abonos_hasta_completar_saldo_y_uno_mas_excede(self):
        orden_id = self._crear_orden(costo_total='30000.00').data['id']
        primero = self._abonar(orden_id, '20000.00')
        segundo = self._abonar(orden_id, '10000.00')
        self.assertEqual(primero.status_code, 201)
        self.assertEqual(segundo.status_code, 201)
        self.assertEqual(Decimal(str(segundo.data['saldo_pendiente'])), Decimal('0.00'))

        tercero = self._abonar(orden_id, '1.00')
        self.assertEqual(tercero.status_code, 409)
        self.assertEqual(tercero.data['code'], 'ABONO_EXCEDE_SALDO')

    def test_medio_de_pago_no_habilitado_responde_400(self):
        pagos = ConfiguracionPago.objects.obtener()
        pagos.acepta_qr = False
        pagos.save()
        orden_id = self._crear_orden().data['id']
        response = self._abonar(orden_id, '20000.00', medio_pago='QR')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'DATOS_INVALIDOS')

    def test_anonimo_recibe_401(self):
        orden_id = self._crear_orden().data['id']
        response = self.c_anonimo.post(f'/api/ordenes-trabajo/{orden_id}/abonos/', {}, format='json')
        self.assertEqual(response.status_code, 401)


class ConsumoOrdenTests(ServiciosAPITestCase):
    """HU-041 — POST/GET /api/ordenes-trabajo/{id}/consumos/ (CU-09, R-15)."""

    def _registrar_consumo(self, orden_id, producto=None, cantidad='2', cliente=None):
        cliente = cliente or self.c_admin
        producto = producto or self.harina
        return cliente.post(
            f'/api/ordenes-trabajo/{orden_id}/consumos/',
            {'operation_id': str(uuid.uuid4()), 'producto_id': str(producto.id), 'cantidad': cantidad},
            format='json',
        )

    def test_camino_feliz_queda_pendiente_sin_mover_stock(self):
        orden_id = self._crear_orden().data['id']
        response = self._registrar_consumo(orden_id)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['estado'], 'PENDIENTE')
        self.harina.refresh_from_db()
        self.assertEqual(self.harina.stock_actual, Decimal('10'))

    def test_no_valida_existencias_al_registrarse(self):
        orden_id = self._crear_orden().data['id']
        response = self._registrar_consumo(orden_id, cantidad='999')
        self.assertEqual(response.status_code, 201)

    def test_producto_inactivo_responde_409(self):
        self.harina.activo = False
        self.harina.save(update_fields=['activo'])
        orden_id = self._crear_orden().data['id']
        response = self._registrar_consumo(orden_id)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'PRODUCTO_INACTIVO')

    def test_consumo_sobre_orden_entregada_responde_409(self):
        orden_id = self._crear_orden().data['id']
        self.c_admin.patch(
            f'/api/ordenes-trabajo/{orden_id}/estado/',
            {'operation_id': str(uuid.uuid4()), 'estado': 'EN_PROCESO'}, format='json',
        )
        self.c_admin.patch(
            f'/api/ordenes-trabajo/{orden_id}/estado/',
            {'operation_id': str(uuid.uuid4()), 'estado': 'LISTO'}, format='json',
        )
        self.c_admin.patch(
            f'/api/ordenes-trabajo/{orden_id}/estado/',
            {'operation_id': str(uuid.uuid4()), 'estado': 'ENTREGADO'}, format='json',
        )
        response = self._registrar_consumo(orden_id)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'ORDEN_YA_ENTREGADA')

    def test_get_lista_los_consumos(self):
        orden_id = self._crear_orden().data['id']
        self._registrar_consumo(orden_id)
        response = self.c_operador.get(f'/api/ordenes-trabajo/{orden_id}/consumos/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_anonimo_recibe_401(self):
        orden_id = self._crear_orden().data['id']
        response = self.c_anonimo.get(f'/api/ordenes-trabajo/{orden_id}/consumos/')
        self.assertEqual(response.status_code, 401)


class CostoOperativoTests(ServiciosAPITestCase):
    """HU-023 — POST/GET /api/ordenes-trabajo/{id}/costos/ (CU-10). Solo ADMIN."""

    def _registrar_costo(self, orden_id, valor='5000.00', cliente=None):
        cliente = cliente or self.c_admin
        return cliente.post(
            f'/api/ordenes-trabajo/{orden_id}/costos/',
            {'operation_id': str(uuid.uuid4()), 'concepto': 'Transporte de insumos', 'valor': valor},
            format='json',
        )

    def test_camino_feliz_recalcula_utilidad_neta(self):
        orden_id = self._crear_orden(costo_total='75000.00').data['id']
        response = self._registrar_costo(orden_id, '5000.00')
        self.assertEqual(response.status_code, 201)

        detalle = self.c_admin.get(f'/api/ordenes-trabajo/{orden_id}/')
        self.assertEqual(Decimal(str(detalle.data['utilidad_neta'])), Decimal('70000.00'))

    def test_get_costos_devuelve_desglose_y_utilidad(self):
        orden_id = self._crear_orden(costo_total='75000.00').data['id']
        self._registrar_costo(orden_id, '5000.00')
        response = self.c_admin.get(f'/api/ordenes-trabajo/{orden_id}/costos/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['costos']), 1)
        self.assertEqual(Decimal(str(response.data['utilidad_neta'])), Decimal('70000.00'))

    def test_operador_no_puede_registrar_costo(self):
        orden_id = self._crear_orden().data['id']
        response = self._registrar_costo(orden_id, cliente=self.c_operador)
        self.assertEqual(response.status_code, 403)
        assert_error_shape(self, response)

    def test_operador_no_puede_consultar_costos(self):
        orden_id = self._crear_orden().data['id']
        response = self.c_operador.get(f'/api/ordenes-trabajo/{orden_id}/costos/')
        self.assertEqual(response.status_code, 403)

    def test_costo_sobre_orden_entregada_responde_409(self):
        orden_id = self._crear_orden().data['id']
        for estado in ('EN_PROCESO', 'LISTO', 'ENTREGADO'):
            self.c_admin.patch(
                f'/api/ordenes-trabajo/{orden_id}/estado/',
                {'operation_id': str(uuid.uuid4()), 'estado': estado}, format='json',
            )
        response = self._registrar_costo(orden_id)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'ORDEN_YA_ENTREGADA')

    def test_anonimo_recibe_401(self):
        orden_id = self._crear_orden().data['id']
        response = self.c_anonimo.get(f'/api/ordenes-trabajo/{orden_id}/costos/')
        self.assertEqual(response.status_code, 401)


class ModuloDesactivadoTests(ServiciosAPITestCase):
    """HU-042 reutilizado: servicios_activo = false bloquea todo /api/ordenes-trabajo/."""

    def test_modulo_desactivado_responde_403(self):
        configuracion = ConfiguracionModulo.objects.obtener()
        configuracion.servicios_activo = False
        configuracion.save()
        response = self._crear_orden()
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['code'], 'MODULO_DESACTIVADO')


class CancelarOrdenTests(ServiciosAPITestCase):
    """D29 (Lote 7, E-20) — PATCH /api/ordenes-trabajo/{id}/cancelar/, solo ADMIN."""

    def _orden(self):
        return OrdenTrabajo.objects.get(pk=self._crear_orden().data['id'])

    def _cancelar(self, orden, cliente=None, **overrides):
        payload = {'operation_id': str(uuid.uuid4()), 'motivo': 'El cliente desistió del pedido'}
        payload.update(overrides)
        return (cliente or self.c_admin).patch(
            f'/api/ordenes-trabajo/{orden.id}/cancelar/', payload, format='json',
        )

    def _abonar(self, orden, medio_pago):
        return self.c_admin.post(
            f'/api/ordenes-trabajo/{orden.id}/abonos/',
            {'operation_id': str(uuid.uuid4()), 'valor': '10000.00', 'medio_pago': medio_pago},
            format='json',
        )

    def test_cancelacion_valida_y_consumos_nunca_se_aplican(self):
        orden = self._orden()
        self.c_admin.post(
            f'/api/ordenes-trabajo/{orden.id}/consumos/',
            {'operation_id': str(uuid.uuid4()), 'producto_id': str(self.harina.id), 'cantidad': '2'},
            format='json',
        )

        response = self._cancelar(orden)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['estado'], 'CANCELADA')
        self.assertEqual(response.data['motivo_cancelacion'], 'El cliente desistió del pedido')
        self.assertEqual(response.data['cancelada_por_id'], self.admin.id)
        self.assertIsNotNone(response.data['fecha_cancelacion'])
        self.assertEqual(ConsumoOrden.objects.get(orden=orden).estado, ConsumoOrden.Estado.PENDIENTE)
        self.harina.refresh_from_db()
        self.assertEqual(self.harina.stock_actual, Decimal('10'))
        self.assertFalse(MovimientoInventario.objects.filter(tipo='SALIDA_SERVICIO').exists())

    def test_listado_excluye_canceladas_salvo_con_filtro(self):
        activa = self._orden()
        cancelada = self._orden()
        self._cancelar(cancelada)

        ids = [o['id'] for o in self.c_admin.get('/api/ordenes-trabajo/').data]
        self.assertIn(str(activa.id), ids)
        self.assertNotIn(str(cancelada.id), ids)
        filtradas = self.c_admin.get('/api/ordenes-trabajo/?estado=CANCELADA').data
        self.assertEqual([o['id'] for o in filtradas], [str(cancelada.id)])

    def test_motivo_obligatorio(self):
        response = self._cancelar(self._orden(), motivo='')
        self.assertEqual(response.status_code, 400)
        assert_error_shape(self, response)

    def test_bloqueada_por_abono_confirmado(self):
        orden = self._orden()
        self._abonar(orden, 'EFECTIVO')

        response = self._cancelar(orden)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'ORDEN_CON_ABONOS')
        self.assertIn('anule', response.data['message'])
        orden.refresh_from_db()
        self.assertEqual(orden.estado, OrdenTrabajo.Estado.RECIBIDO)

    def test_bloqueada_por_abono_pendiente_de_verificacion(self):
        orden = self._orden()
        self._abonar(orden, 'TRANSFERENCIA')

        response = self._cancelar(orden)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'ORDEN_CON_ABONOS')

    def test_abono_anulado_no_bloquea(self):
        orden = self._orden()
        abono_id = self._abonar(orden, 'TRANSFERENCIA').data['id']
        movimiento = MovimientoCaja.objects.get(abono_id=abono_id)
        self.c_admin.patch(
            f'/api/movimientos-caja/{movimiento.id}/anular/', {'motivo': 'La transferencia no llegó'},
            format='json',
        )

        response = self._cancelar(orden)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['estado'], 'CANCELADA')

    def test_sobre_entregada_responde_orden_ya_entregada(self):
        orden = self._orden()
        for estado in ('EN_PROCESO', 'LISTO', 'ENTREGADO'):
            self.c_admin.patch(f'/api/ordenes-trabajo/{orden.id}/estado/', {'estado': estado}, format='json')

        response = self._cancelar(orden)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'ORDEN_YA_ENTREGADA')

    def test_operaciones_sobre_orden_cancelada(self):
        orden = self._orden()
        self._cancelar(orden)
        base = f'/api/ordenes-trabajo/{orden.id}'

        respuestas = [
            self.c_admin.patch(f'{base}/estado/', {'estado': 'EN_PROCESO'}, format='json'),
            self._abonar(orden, 'EFECTIVO'),
            self.c_admin.post(
                f'{base}/consumos/', {'producto_id': str(self.harina.id), 'cantidad': '1'}, format='json',
            ),
            self.c_admin.post(f'{base}/costos/', {'concepto': 'Gas', 'valor': '5000'}, format='json'),
            self._cancelar(orden),
        ]

        for response in respuestas:
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.data['code'], 'ORDEN_CANCELADA')
        self.assertFalse(Abono.objects.filter(orden=orden).exists())

    def test_operador_recibe_403(self):
        orden = self._orden()
        response = self._cancelar(orden, cliente=self.c_operador)
        self.assertEqual(response.status_code, 403)
        orden.refresh_from_db()
        self.assertEqual(orden.estado, OrdenTrabajo.Estado.RECIBIDO)

    def test_idempotencia_por_operation_id(self):
        orden = self._orden()
        operation_id = str(uuid.uuid4())
        primera = self._cancelar(orden, operation_id=operation_id)
        segunda = self._cancelar(orden, operation_id=operation_id)
        self.assertEqual(primera.status_code, 200)
        self.assertEqual(segunda.status_code, 200)
        self.assertEqual(segunda.data['estado'], 'CANCELADA')
