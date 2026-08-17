import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationRepository } from './conversation.repository';
import type { ConversationSession, ConversationTurn } from './conversation.types';
import { DataApiError } from './supabase-data-api.service';

@Injectable()
export class ConversationService {
  constructor(private readonly repository: ConversationRepository) {}

  createSession(userId: string, accessToken: string): Promise<ConversationSession> {
    return this.repository.createSession(accessToken, randomUUID(), userId);
  }

  async resumeSession(userId: string, accessToken: string, sessionId: string): Promise<ConversationSession> {
    const session = await this.repository.findSession(accessToken, sessionId, userId);
    if (!session) throw new NotFoundException('Conversation session was not found.');
    return session;
  }

  async createTurn(userId: string, accessToken: string, sessionId: string, body: unknown): Promise<ConversationTurn> {
    const input = this.validateTurnInput(body);
    await this.resumeSession(userId, accessToken, sessionId);
    if (input.idempotencyKey) {
      const existing = await this.repository.findTurnByIdempotencyKey(accessToken, sessionId, userId, input.idempotencyKey);
      if (existing) return existing;
    }
    try {
      return await this.repository.createTurn(accessToken, {
        id: randomUUID(), sessionId, userId, content: input.content, idempotencyKey: input.idempotencyKey,
      });
    } catch (error) {
      if (input.idempotencyKey && error instanceof DataApiError && error.status === 409) {
        const winner = await this.repository.findTurnByIdempotencyKey(accessToken, sessionId, userId, input.idempotencyKey);
        if (winner) return winner;
      }
      throw error;
    }
  }

  async cancelTurn(userId: string, accessToken: string, sessionId: string, turnId: string): Promise<ConversationTurn> {
    await this.resumeSession(userId, accessToken, sessionId);
    const turn = await this.repository.cancelTurn(accessToken, sessionId, turnId, userId);
    if (!turn) throw new ConflictException('Turn is missing or already terminal.');
    return turn;
  }

  private validateTurnInput(body: unknown): { content: string; idempotencyKey?: string } {
    if (!body || typeof body !== 'object') throw new BadRequestException('Request body is required.');
    const value = body as Record<string, unknown>;
    if (typeof value.content !== 'string' || value.content.trim().length === 0 || value.content.length > 20000) {
      throw new BadRequestException('content must contain between 1 and 20000 characters.');
    }
    if (value.idempotencyKey !== undefined &&
      (typeof value.idempotencyKey !== 'string' || value.idempotencyKey.length < 1 || value.idempotencyKey.length > 128)) {
      throw new BadRequestException('idempotencyKey must contain between 1 and 128 characters.');
    }
    const allowed = new Set(['content', 'idempotencyKey']);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
      throw new BadRequestException('Request contains unsupported fields.');
    }
    return { content: value.content, ...(typeof value.idempotencyKey === 'string' ? { idempotencyKey: value.idempotencyKey } : {}) };
  }
}
