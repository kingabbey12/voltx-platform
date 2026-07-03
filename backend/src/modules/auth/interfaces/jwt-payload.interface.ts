export interface JwtAccessPayload {
  sub: string;
  org?: string;
  type: 'access';
}
