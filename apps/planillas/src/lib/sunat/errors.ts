export class SunatError extends Error {
  constructor(
    message: string,
    readonly codigo?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SunatError";
  }
}

export class SunatCredencialesInvalidasError extends SunatError {
  constructor(message = "SUNAT rechazó la clave SOL o el client secret.") {
    super(message, "CREDENCIALES");
    this.name = "SunatCredencialesInvalidasError";
  }
}

export class SunatTimeoutError extends SunatError {
  constructor() {
    super("SUNAT no respondió a tiempo. Inténtelo de nuevo en un momento.", "TIMEOUT");
    this.name = "SunatTimeoutError";
  }
}

export class SunatTicketPendienteError extends SunatError {
  constructor(
    readonly numTicket: string,
    readonly codEstado: string,
    readonly desEstado: string,
  ) {
    super(
      `SUNAT sigue armando el archivo del mes (ticket ${numTicket}). Vuelva a pulsar descargar en un minuto.`,
      "TICKET_PENDIENTE",
    );
    this.name = "SunatTicketPendienteError";
  }
}
