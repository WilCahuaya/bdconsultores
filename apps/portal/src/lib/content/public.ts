export const HERO = {
  quote:
    "Experiencia contable y control patrimonial para una gestión eficiente y transparente.",
  subtitle:
    "Asesoría contable, tributaria y servicios especializados de inventario y control de activos para instituciones públicas y privadas.",
} as const;

export const INICIO = {
  heading: "Soluciones contables, tributarias y de control patrimonial para instituciones y empresas",
  intro: [
    "B&D Consultores Global EIRL es un estudio contable especializado en brindar servicios de asesoría contable, tributaria, financiera y control de activos fijos para entidades públicas y privadas.",
    "Acompañamos a nuestros clientes en la gestión eficiente de sus recursos, garantizando información confiable para una adecuada toma de decisiones.",
  ],
  serviciosPrincipales: [
    "Asesoría contable integral",
    "Declaraciones tributarias",
    "Estados financieros",
    "Auditoría y consultoría",
    "Inventario físico de activos fijos",
    "Control patrimonial institucional",
    "Conciliación físico-contable",
    "Implementación de sistemas de control de bienes",
  ],
} as const;

export const NOSOTROS = {
  heading: "Más que contabilidad, una gestión integral para su organización",
  intro: [
    "En B&D Consultores Global EIRL ofrecemos servicios profesionales orientados a fortalecer la gestión administrativa, contable y patrimonial de nuestros clientes.",
    "Nuestro equipo combina experiencia contable con herramientas tecnológicas que permiten optimizar procesos, mejorar el control interno y garantizar información precisa para la toma de decisiones.",
  ],
  mision:
    "Brindar servicios contables y de consultoría con altos estándares de calidad, contribuyendo al crecimiento y fortalecimiento institucional de nuestros clientes.",
  vision:
    "Ser una firma reconocida por su excelencia profesional, innovación y compromiso en la prestación de servicios contables y de gestión patrimonial.",
} as const;

export const SERVICIOS = [
  {
    title: "Asesoría Contable",
    description:
      "Registro, análisis y control de operaciones contables conforme a la normativa vigente.",
  },
  {
    title: "Asesoría Tributaria",
    description:
      "Planeamiento tributario, cumplimiento de obligaciones fiscales y asistencia ante requerimientos.",
  },
  {
    title: "Elaboración de Estados Financieros",
    description:
      "Preparación de información financiera confiable para la toma de decisiones empresariales.",
  },
  {
    title: "Auditoría y Consultoría",
    description:
      "Evaluación de procesos administrativos, financieros y de control interno.",
  },
  {
    title: "Inventario Físico de Activos Fijos",
    description:
      "Levantamiento físico, identificación y registro detallado de bienes patrimoniales.",
  },
  {
    title: "Control Patrimonial",
    description:
      "Administración y seguimiento de activos institucionales mediante procedimientos técnicos y tecnológicos.",
  },
  {
    title: "Conciliación Físico-Contable",
    description:
      "Validación entre la existencia física de bienes y los registros contables institucionales.",
  },
  {
    title: "Implementación de Sistemas de Inventario",
    description:
      "Desarrollo e implementación de soluciones digitales para el control de activos y bienes patrimoniales.",
  },
] as const;

export const CLIENTES = {
  heading: "Soluciones adaptadas a diversos sectores",
  intro:
    "Atendemos organizaciones que requieren servicios contables y de control patrimonial:",
  sectores: {
    publico: {
      title: "Sector Público",
      items: [
        "Municipalidades",
        "Gobiernos Regionales",
        "Instituciones educativas",
        "Programas sociales",
      ],
    },
    privado: {
      title: "Sector Privado",
      items: [
        "Empresas comerciales",
        "Empresas industriales",
        "Empresas de servicios",
        "Organizaciones sin fines de lucro",
        "Asociaciones",
        "Fundaciones",
        "Iglesias",
        "ONG",
      ],
    },
  },
} as const;

export const BLOG = {
  heading: "Información útil para una gestión eficiente",
  posts: [
    {
      slug: "control-patrimonial-instituciones-publicas",
      title: "La importancia del control patrimonial en las instituciones públicas",
      date: "Junio 2026",
      excerpt:
        "Por qué el control de bienes es clave para la transparencia y la rendición de cuentas en el sector público.",
    },
    {
      slug: "beneficios-inventarios-fisicos-periodicos",
      title: "Beneficios de realizar inventarios físicos periódicos",
      date: "Junio 2026",
      excerpt:
        "Cómo los inventarios regulares mejoran el control interno y reducen riesgos de pérdida o desvío.",
    },
    {
      slug: "errores-gestion-activos-fijos",
      title: "Principales errores en la gestión de activos fijos",
      date: "Junio 2026",
      excerpt:
        "Errores frecuentes en el registro, etiquetado y seguimiento de activos, y cómo evitarlos.",
    },
    {
      slug: "actualizaciones-tributarias-empresas",
      title: "Actualizaciones tributarias para empresas",
      date: "Junio 2026",
      excerpt:
        "Aspectos tributarios relevantes para el cumplimiento oportuno de obligaciones fiscales.",
    },
    {
      slug: "buenas-practicas-contables-organizaciones",
      title: "Buenas prácticas contables para organizaciones en crecimiento",
      date: "Junio 2026",
      excerpt:
        "Recomendaciones para fortalecer la gestión contable a medida que la organización crece.",
    },
    {
      slug: "tecnologia-control-bienes-patrimoniales",
      title: "Tecnología aplicada al control de bienes patrimoniales",
      date: "Junio 2026",
      excerpt:
        "Herramientas digitales que optimizan el inventario, la trazabilidad y el control de activos.",
    },
  ],
} as const;

export const BLOG_CONTENT: Record<
  string,
  { title: string; date: string; content: string[] }
> = {
  "control-patrimonial-instituciones-publicas": {
    title: "La importancia del control patrimonial en las instituciones públicas",
    date: "Junio 2026",
    content: [
      "El control patrimonial en las instituciones públicas es fundamental para garantizar la transparencia en el uso de los recursos del Estado y la correcta rendición de cuentas ante la ciudadanía.",
      "Un adecuado registro y seguimiento de los bienes permite detectar omisiones, pérdidas o desvíos a tiempo, fortaleciendo el control interno y el cumplimiento normativo.",
      "En B&D Consultores Global EIRL acompañamos a entidades públicas en la implementación de procedimientos técnicos y herramientas que facilitan la gestión patrimonial de manera eficiente.",
    ],
  },
  "beneficios-inventarios-fisicos-periodicos": {
    title: "Beneficios de realizar inventarios físicos periódicos",
    date: "Junio 2026",
    content: [
      "Los inventarios físicos periódicos permiten contrastar la existencia real de los bienes con los registros contables, identificando diferencias que requieren ajustes o investigación.",
      "Entre sus beneficios destacan la reducción de riesgos de pérdida, el mejoramiento del control interno y la obtención de información actualizada para la toma de decisiones.",
      "Recomendamos establecer calendarios de inventario acordes al volumen y rotación de activos de cada organización.",
    ],
  },
  "errores-gestion-activos-fijos": {
    title: "Principales errores en la gestión de activos fijos",
    date: "Junio 2026",
    content: [
      "Entre los errores más frecuentes se encuentran la falta de identificación única de bienes, registros incompletos, ausencia de conciliación físico-contable y depreciación incorrecta.",
      "También es común no documentar traslados, bajas o mejoras, lo que genera inconsistencias entre el área operativa y la contabilidad.",
      "Corregir estos aspectos con procesos claros y apoyo tecnológico mejora significativamente la calidad de la información patrimonial.",
    ],
  },
  "actualizaciones-tributarias-empresas": {
    title: "Actualizaciones tributarias para empresas",
    date: "Junio 2026",
    content: [
      "El cumplimiento tributario exige estar al día con las normas vigentes y los plazos de declaración y pago establecidos por la SUNAT.",
      "Un adecuado planeamiento tributario permite optimizar la carga fiscal dentro del marco legal y anticipar obligaciones relevantes para la empresa.",
      "Nuestro equipo brinda asesoría para el cumplimiento oportuno y la atención de requerimientos de la autoridad fiscal.",
    ],
  },
  "buenas-practicas-contables-organizaciones": {
    title: "Buenas prácticas contables para organizaciones en crecimiento",
    date: "Junio 2026",
    content: [
      "Las organizaciones en crecimiento requieren procesos contables escalables: documentación ordenada, cierre mensual, conciliaciones periódicas y separación clara de funciones.",
      "Implementar controles desde etapas tempranas evita reprocesos costosos y facilita auditorías internas o externas.",
      "La combinación de criterios contables sólidos con herramientas tecnológicas acelera la generación de información confiable para la dirección.",
    ],
  },
  "tecnologia-control-bienes-patrimoniales": {
    title: "Tecnología aplicada al control de bienes patrimoniales",
    date: "Junio 2026",
    content: [
      "Las soluciones digitales para inventario y control patrimonial permiten registrar bienes con códigos únicos, fotografías, ubicación y trazabilidad en tiempo real.",
      "El uso de etiquetas, escaneo en campo y plataformas web centralizadas reduce tiempos de levantamiento y mejora la calidad de los reportes.",
      "En B&D Consultores Global EIRL desarrollamos e implementamos sistemas adaptados a las necesidades de entidades públicas y privadas.",
    ],
  },
};

export const CONTACTO = {
  heading: "Conversemos sobre las necesidades de su organización",
  intro:
    "Nuestro equipo está preparado para brindar asesoría especializada en materia contable, tributaria y de control patrimonial.",
  empresa: "B&D Consultores Global EIRL",
  direccion: "Huancayo, Junín - Perú",
  telefono: "+51 XXX XXX XXX",
  email: "contacto@bdconsultores.pe",
  cotizacion: {
    title: "Solicite una cotización",
    description:
      "Cuéntenos sobre su proyecto y elaboraremos una propuesta acorde a sus necesidades.",
  },
} as const;
