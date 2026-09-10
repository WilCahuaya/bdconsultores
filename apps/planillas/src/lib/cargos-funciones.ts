export const CARGOS_TRABAJADOR = [
  "Administrador",
  "Responsable de tesorería, logística y almacén",
  "Responsable de procesos administrativos y comunicaciones del participante",
  "Coordinador de implementación programática y monitoreo",
  "Formador educativo y espiritual",
] as const;

export type CargoTrabajador = (typeof CARGOS_TRABAJADOR)[number];

const CARGO_ALIAS: Record<string, CargoTrabajador> = {
  tesorero: "Responsable de tesorería, logística y almacén",
  "responsable de tesorería, logística y almacén": "Responsable de tesorería, logística y almacén",
  secretario: "Responsable de procesos administrativos y comunicaciones del participante",
  "responsable de procesos administrativos y comunicaciones del participante":
    "Responsable de procesos administrativos y comunicaciones del participante",
  coordinador: "Coordinador de implementación programática y monitoreo",
  "coordinador de implementación programática y monitoreo": "Coordinador de implementación programática y monitoreo",
  "formador educativo espiritual": "Formador educativo y espiritual",
  "formador educativo y espiritual": "Formador educativo y espiritual",
  administrador: "Administrador",
};

export function cargoCanonico(value: string | null | undefined): CargoTrabajador | null {
  const raw = value?.trim();
  if (!raw) return null;
  const mapped = CARGO_ALIAS[raw.toLowerCase()];
  if (mapped) return mapped;
  return (CARGOS_TRABAJADOR as readonly string[]).includes(raw) ? (raw as CargoTrabajador) : null;
}

export function esCargoTrabajador(value: string): value is CargoTrabajador {
  return cargoCanonico(value) != null;
}

export const FUNCIONES_POR_CARGO: Record<CargoTrabajador, string[]> = {
  Administrador: [
    "Coordinar, supervisar y dirigir los procedimientos administrativos, logísticos y de recursos humanos del Programa.",
    "Planificar, dirigir y coordinar las intervenciones del Programa.",
    "Consolidar e informar mensualmente al Consejo Directivo de la Asociación sobre el desarrollo del Programa, proponiendo mejoras para la atención de los participantes.",
    "Ejecutar transferencias de los participantes a otros Programas y coordinar salidas planeadas y no planeadas con el Facilitador.",
    "Elaborar juntamente con el Pastor, el Consejo Directivo y el equipo del Programa el Plan Operativo y presupuesto anual.",
    "Presentar formalmente al Titular del Consejo Directivo por escrito solicitudes de gastos ordinarios y extraordinarios, junto con el reporte financiero mensual.",
    "Aprobar juntamente con el presidente de la Asociación el Reporte Financiero Mensual, informando el uso de los fondos según el Plan y Presupuesto aprobado.",
    "Asesorar al Consejo Directivo de la Asociación, al Pastor y a otros líderes en temas administrativos sobre la ejecución de actividades del Programa.",
    "Mantener un adecuado nivel de comunicación entre la Asociación y Compasión.",
    "Supervisar, monitorear y dar seguimiento al equipo de trabajo y voluntarios, asegurando el correcto desarrollo de actividades y previniendo riesgos.",
    "Liderar el trabajo en equipo mediante estrategias de comunicación y gestión eficiente del personal.",
    "Mantener un ambiente laboral estable, garantizando seguridad, salud y bienestar en el equipo de trabajo.",
    "Estar en constante comunicación con el personal para garantizar un flujo adecuado de información.",
    "Mantener el orden, atender incidencias y solucionar conflictos internos.",
    "Velar por la conservación, orden y mantenimiento de los bienes, archivos y documentos institucionales.",
    "Gestionar trámites de reembolsos médicos y otros ante Compassion.",
    "Convocar y dirigir reuniones mensuales de coordinación, planificación y evaluación con su jefe inmediato superior y el equipo de trabajo.",
    "Ejecutar reuniones generales de coordinación con los padres de familia del Programa cuando se requiera.",
    "Garantizar el uso eficiente y transparente de los recursos económicos, materiales e intangibles.",
    "Supervisar al personal contratado, practicantes y voluntarios.",
    "Evaluar el desempeño del personal y proponer programas de formación.",
    "Controlar la asistencia, permisos y cumplimiento de funciones del equipo.",
    "Conformar el comité de selección y contratación según las políticas institucionales.",
    "Liderar y promover una adecuada cultura y clima organizacional en el Programa.",
    "Representar a la Asociación ante entidades públicas o privadas cuando el Consejo Directivo lo autorice (convenios, reuniones, movilización de recursos, entre otros).",
    "Monitorear y garantizar el cumplimiento de metas e indicadores.",
    "Ingresar información al RESOLVER y hacer el seguimiento de los casos vulnerables con el apoyo de los formadores.",
    "Realizar otras funciones que les sean asignadas por su superior jerárquico.",
  ],
  "Formador educativo y espiritual": [
    "Brindar acompañamiento formativo que integre lo espiritual, académico y humano promoviendo el desarrollo integral de los participantes mediante procesos pedagógicos, reflexivos y vivenciales que fortalezcan valores cristianos, sentido de vida y compromiso social.",
    "Colaborar en la elaboración, implementación y evaluación del plan operativo con respecto a los participantes a cargo.",
    "Preparar las lecciones solicitando los materiales curriculares con tiempo.",
    "Velar por el buen uso y estado del mobiliario y recursos entregados.",
    "Facilitar la colaboración con actores externos y asegurar el seguimiento de los recursos y acciones para optimizar la atención de los participantes.",
    "Mantener actualizados los diarios de clase, registros y formatos asignados.",
    "Presentar oportunamente los fólderes de asistencia y evidencias del monitoreo y evaluación.",
    "Organizar la logística de talleres, charlas entre otros, garantizando que las actividades se desarrollen de manera efectiva.",
    "Aplicar y adaptar el currículo de acuerdo con las necesidades del aula, respetando los lineamientos institucionales.",
    "Desarrollar las lecciones del currículo de manera responsable, implementando metodologías activas (aprendizaje experiencial, diálogo reflexivo, dinámicas grupales).",
    "Elaborar materiales didácticos y recursos pedagógicos acordes al nivel y necesidades de los participantes.",
    "Evaluar el progreso formativo de los participantes en los formatos correspondientes y proponer mejoras continuas.",
    "Diseñar horarios y actividades que respondan al contexto del niño o adolescente.",
    "Implementar estrategias y dinámicas variadas que fomenten la participación.",
    "Facilitar espacios de reflexión espiritual conforme a la identidad de la iglesia.",
    "Acompañamiento con discipulado y mentoreo de acuerdo con cada necesidad.",
    "Coordinar y liderar retiros, convivencias, jornadas espirituales entre otras prácticas cristianas.",
    "Promover los valores cristianos dentro y fuera del salón de clase.",
    "Promover iniciativas de servicio, voluntariado y compromiso social.",
    "Brindar atención personalizada a cada beneficiario, monitoreando su desarrollo integral.",
    "Realizar visitas domiciliarias conforme al mínimo establecido.",
    "Detectar, comunicar y dar seguimiento a casos especiales o situaciones de riesgo.",
    "Llevar el control y seguimiento individual de cada niño mediante los formatos oficiales.",
    "Comunicar de manera inmediata cualquier situación de riesgo o vulneración de derechos.",
    "Detectar oportunamente situaciones de salud de los participantes y comunicar a la administración.",
    "Orientar, acompañar y revisar que las cartas se redacten cumpliendo con la estructura y normas establecidas.",
    "Asegurar que los indicadores de la comunicación niño-padrino estén al día (correspondencia, actualizaciones, regalos, otros), en colaboración con el administrativo.",
    "Asegurar la compra de regalos o algún otro apoyo de manera correcta contando con las evidencias para entregar al encargado de tesorería, logística y almacén en el tiempo correspondiente.",
    "Promover un ambiente de buen trato, respeto y equidad dentro del aula.",
    "Realizar actividades recreativas que fortalezcan el desarrollo de los participantes.",
    "Mantener permanente contacto con el 100% de los participantes asignados, cumpliendo la promesa de conocerlos, amarlos y conectarlos, mediante visitas domiciliarias programadas y de seguimiento (en casos de salud, inasistencia o necesidades especiales) y otras formas de contacto.",
    "Mantener una comunicación clara, respetuosa y permanente con los padres o cuidadores, informando avances, dificultades y necesidades del niño o adolescente.",
    "Promover la participación de la familia en el proceso de desarrollo integral del participante.",
    "Participar en reuniones de equipo, capacitaciones internas y proyectos interdisciplinarios en coordinación con el administrador.",
    "Realizar otras funciones que les sean asignadas por su superior jerárquico.",
  ],
  "Responsable de tesorería, logística y almacén": [
    "Gestionar los recursos financieros del Programa.",
    "Ingresar la información al fastrack o sistema implementado y elaborar el Reporte Financiero Mensual del mes anterior dentro de los primeros días del mes. Revisar y conciliar los saldos bancarios, en coordinación con el contador. Subir el RFM a la nube, máximo hasta el día 10 de cada mes con las correspondientes firmas de aprobación.",
    "Supervisar y controlar las entradas y salidas de dinero.",
    "Asegurar que el Programa siempre tenga suficiente efectivo o liquidez para cubrir sus operaciones diarias y obligaciones financieras.",
    "Controlar y ejecutar pagos a proveedores, planillas, obligaciones bancarias y otros.",
    "Velar por el cumplimiento de evitar el conflicto de intereses con proveedores y el reporte de casos de los mismos.",
    "Cumplir con los procedimientos establecidos en su manual de Finanzas o guía de Finanzas de Compassion. Garantizar el cumplimiento de políticas internas, regulaciones y normativas legales (tributarias, financieras y de compliance).",
    "Formular, ejecutar y evaluar el Plan Operativo juntamente con el equipo del programa y con el liderazgo de la Iglesia.",
    "Maximizar los rendimientos de los fondos disponibles del Programa, obteniendo el mayor beneficio posible del dinero asignado sin comprometer la seguridad financiera.",
    "Monitorizar el desempeño financiero del Programa en relación con el presupuesto aprobado. Si surgen desviaciones o cambios significativos, el tesorero(a) evalúa si es necesario ajustar el presupuesto y lo comunica al Administrador.",
    "Mantener ordenado el archivo de comprobantes, lista de proveedores, cotizaciones, documentos sustentatorios y autorizaciones de todas las compras realizadas por el Programa.",
    "Coordinar y asegurar juntamente con el Administrador todas las compras requeridas.",
    "Asegurar la compra de regalos de manera puntual de acuerdo con la estrategia implementada por la FCP.",
    "Cambiar el estatus del regalo en CONNECT una vez realizada la compra y teniendo las evidencias (comprobante y fotografía).",
    "Mantener registros financieros precisos y transparentes.",
    "Manejo diario del dinero y libro de caja chica.",
    "Velar por el cumplimiento de las obligaciones tributarias y laborales, en coordinación con el contador.",
    "Informar periódicamente a la Asamblea General y al Consejo Directivo sobre la situación económica de la asociación, cuando sea requerido.",
    "Velar porque todo gasto que realice el programa cuente con el respectivo comprobante de pago (boletas, facturas u otro documento válido).",
    "Coordinar y brindar soporte en la entrega de beneficios generales a los participantes.",
    "Recibir las compras, y verificar que todo esté en orden según la orden de compra o guía de remisión.",
    "Realizar el inventario general anual con la guía del contador y cuando fuera necesario.",
    "Organizar y colocar los productos en el almacén, asegurándose de que estén seguros y accesibles, manteniendo el almacén limpio y ordenado.",
    "Llevar un registro preciso de la cantidad de productos en stock, actualizando el Kardex cuando hay entradas o salidas.",
    "Preparar y entregar los requerimientos según las solicitudes recibidas, asegurándose de que todo esté completo y en buen estado.",
    "Realizar otras funciones que les sean asignadas por su superior jerárquico.",
  ],
  "Responsable de procesos administrativos y comunicaciones del participante": [
    "Elaborar, revisar y archivar documentos de la asociación (oficios, cartas, informes, contratos, actas, etc.), así como documentos relacionados a la atención del niño como: entrevistas, visitas, compromisos, apoyos sociales, educativos, chequeos médicos, entre otros.",
    "Coordinar la logística para reuniones, talleres, asambleas, capacitaciones o eventos institucionales.",
    "Brindar asistencia en la atención al público, socios, voluntarios y visitantes, proporcionando información general.",
    "Apoyar en la elaboración del presupuesto operativo y el seguimiento de la ejecución de gastos.",
    "Colaborar en la elaboración y difusión de comunicados institucionales.",
    "Apoyo en la coordinación y ejecución de compras requeridas en el Programa.",
    "Revisar continuamente en CONNECT el “PE Tablero Cartas” y “PE Tablero Operativo Iglesia” y atender los pendientes que se muestren en los tableros.",
    "Revisar continuamente el BLP en CONNECT para verificar si hay cartas pendientes de escribir o para aprobar.",
    "Estar pendiente de las comunicaciones de parte de la Asociada de Campo de Compassion (SDS) y atender las solicitudes.",
    "Solicitar formatos en blanco de los tipos de carta antes que se agoten y recoger el envío del paquete.",
    "Imprimir el packing list de Connect para un mejor control de cartas pendientes.",
    "Imprimir los encabezados de cartas físicas, organizarlos y entregarlos a los Formadores para que los participantes a su cargo escriban las cartas (en caso no se complete la carta en el horario de contacto esencial, encargarse de buscar al participante y completar la carta).",
    "Recibir de los formadores, revisar y escanear las cartas y subirlas a la nube. En caso una carta esté escrita de manera incorrecta deberá gestionar su corrección.",
    "Respecto a las cartas BLP, informar al tutor el código y nombre de los participantes a su cargo que tienen cartas. Dar seguimiento y asegurar que sean escritas dentro del plazo indicado. Una vez escrita revisar y aprobar.",
    "Coordinar con el tesorero(a) la entrega de regalos según cartas y registros en Connect. A continuación, asegurarse de que las cartas de agradecimiento y las fotos sean enviadas dentro del plazo.",
    "Tomar las fotografías de actualización de los participantes con los estándares requeridos y dentro de los plazos establecidos.",
    "Actualizar las cuentas de los participantes cada 18 meses y crear los eventos de actualización.",
    "Registrar la asistencia de los participantes en el formato digital implementado.",
    "Preparar formatos de inscripción de nuevos niños y toma de fotografía.",
    "Elaboración de reportes mensuales correspondientes a su rol.",
    "Facilitar formatos de uso general a los miembros del equipo que lo requieran.",
    "Cumplir con otras funciones administrativas y de apoyo que le sean asignadas por el Administrador.",
    "Realizar otras funciones que les sean asignadas por su superior jerárquico.",
  ],
  "Coordinador de implementación programática y monitoreo": [
    "Planificar las intervenciones del programa según grupos etarios y necesidades identificadas.",
    "Elaborar propuestas de mejora programática en coordinación con el Administrador y el Pastor.",
    "Asegurar la correcta implementación de las intervenciones educativas, formativas y espirituales.",
    "Dar seguimiento al progreso académico, formativo y espiritual de los niños y adolescentes.",
    "Verificar que las actividades se desarrollen conforme a los currículos y materiales de Compassion.",
    "Realizar monitoreo periódico en aulas y espacios de atención.",
    "Brindar asesoría técnica y pedagógica continua a los formadores educativos y espirituales.",
    "Identificar necesidades de capacitación y coordinar formaciones internas o externas.",
    "Asegurar que los formadores educativos cuenten con herramientas metodológicas adecuadas.",
    "Evaluar la calidad y resultados de las intervenciones programáticas.",
    "Revisar informes de avance académico y formativo.",
    "Proponer acciones correctivas o de mejora continua.",
    "Diseñar y supervisar el plan de evangelismo y discipulado del programa.",
    "Asegurar una enseñanza creativa, variada y bíblica de la Palabra de Dios.",
    "Monitorear la ejecución del discipulado en las aulas.",
    "Coordinar con el Administrador del Programa para la adecuada ejecución del plan anual.",
    "Coordinar con el Defensor de Protección Infantil ante situaciones de riesgo.",
    "Apoyar técnicamente al equipo en visitas domiciliarias y seguimiento individual, sin reemplazar al formador educativo.",
    "Realizar otras funciones que les sean asignadas por su superior jerárquico.",
  ],
};

export function funcionesDeCargo(cargo: string | null | undefined): string[] {
  const canon = cargoCanonico(cargo);
  if (!canon) return [];
  return FUNCIONES_POR_CARGO[canon];
}

/** Código de ocupación SUNAT (T-Registro) según el cargo. */
export const CODIGO_OCUPACION_TREGISTRO: Record<CargoTrabajador, string> = {
  Administrador: "252003",
  "Responsable de tesorería, logística y almacén": "451020",
  "Responsable de procesos administrativos y comunicaciones del participante": "413016",
  "Coordinador de implementación programática y monitoreo": "246004",
  "Formador educativo y espiritual": "246004",
};

export function codigoOcupacionTRegistro(cargo: string | null | undefined): string {
  const canon = cargoCanonico(cargo);
  return canon ? CODIGO_OCUPACION_TREGISTRO[canon] : "";
}
