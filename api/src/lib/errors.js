// Erro com status HTTP e um código estável que o front usa para decidir a mensagem.
export class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const badRequest = (message, code = 'INVALID') => new HttpError(400, code, message);
export const unauthorized = () => new HttpError(401, 'UNAUTHORIZED', 'Entre na sua conta para continuar.');
export const forbidden = (message = 'Você não tem acesso a isso.', code = 'FORBIDDEN', extra) => new HttpError(403, code, message, extra);
export const notFound = (message = 'Não encontrado.') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message, code = 'CONFLICT') => new HttpError(409, code, message);

// Valida a entrada com zod; campos fora do schema são descartados (o cliente não manda role nem status).
export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new HttpError(400, 'INVALID', issue.message, { field: issue.path.join('.') });
  }
  return result.data;
}