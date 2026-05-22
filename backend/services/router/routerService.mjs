// Keyword-based unit router for Inversiones Manglar.
// Each unit has a list of trigger keywords. The unit with the most matches wins.

const UNIT_KEYWORDS = {
  juridico: [
    "demanda", "demandas", "abogado", "abogados", "proceso", "procesos",
    "ugpp", "seguridad social", "parafiscales", "aportes",
    "seguros", "aseguradora", "poliza", "póliza", "siniestro",
    "derecho administrativo", "contencioso", "tutela", "accion de tutela",
    "acción de tutela", "derecho fundamental",
    "electoral", "jurado de votacion", "jurado de votación", "registraduria",
    "asesoría jurídica", "asesoria juridica", "juridico", "jurídico",
    "conciliacion", "conciliación", "contrato", "contratos", "litigio",
    "recurso", "apelacion", "apelación", "reposicion", "reposición",
    "derecho de peticion", "derecho de petición",
    "cardenas romero", "cárdenas romero",
  ],
  consulting: [
    "dian", "rut", "tributario", "tributaria", "impuesto",
    "anla", "licencia ambiental", "cepd", "prueba dinamica", "prueba dinámica",
    "upme", "certificado upme",
    "importacion", "importación", "vehiculo electrico", "vehículo eléctrico",
    "carro electrico", "carro eléctrico", "ev", "hibrido", "híbrido",
    "cargador", "cargadores", "electrolinera", "electrolineras",
    "retie", "infraestructura electrica", "infraestructura eléctrica",
    "iva", "devolucion iva", "devolución iva", "beneficio tributario",
    "regulatorio", "regulatoria", "permiso", "permisos",
    "logistica", "logística", "importaciones",
    "src consulting", "src",
    "movilidad electrica", "movilidad eléctrica",
  ],
  hotel: [
    "hospedaje", "hotel", "habitacion", "habitación", "cuarto",
    "glamping", "cabaña", "cabañas", "camping",
    "guatavita", "naturaleza", "ecoturismo", "ecologico", "ecológico",
    "reserva", "reservas", "reservar", "disponibilidad",
    "inversion", "inversión", "inversionista", "socio", "participar",
    "club privado", "membresia", "membresía",
    "mucuba",
  ],
};

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function detectUnit(message, company) {
  const normalizedMessage = normalize(message);
  const scores = {};

  for (const [unitType, keywords] of Object.entries(UNIT_KEYWORDS)) {
    scores[unitType] = keywords.filter((kw) =>
      normalizedMessage.includes(normalize(kw))
    ).length;
  }

  const topType = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  if (!topType || topType[1] === 0) return null;

  const unit = company.units?.find((u) => u.type === topType[0]);
  return unit ?? null;
}
