const crypto = require('crypto');
const db = require('../database/db');
const { money } = require('../utils/format');
const { getOrCreatePlayerFromMessage } = require('./playerService');
const { grantZenies } = require('./rewardService');
const { mentionPlayer, mentionIds } = require('../utils/mentions');

const INVITE_INITIAL_REWARD = 100_000_000;
const RECRUIT_WINDOW_HOURS = 5;
const RECRUITER_MIN_AGE_HOURS = 5;
const REFERRAL_BONUS_DAYS = 14;

function hoursSince(dateText) {
  const time = new Date(dateText).getTime();
  if (!Number.isFinite(time)) return Infinity;
  return (Date.now() - time) / (60 * 60 * 1000);
}

function generateCode() {
  return `CONV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function getInviteCode(message) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  let row = db.prepare('SELECT * FROM referral_codes WHERE player_id = ?').get(player.id);

  if (!row) {
    let code;
    let inserted = false;
    while (!inserted) {
      code = generateCode();
      try {
        db.prepare(`
          INSERT INTO referral_codes (player_id, code)
          VALUES (?, ?)
        `).run(player.id, code);
        inserted = true;
      } catch (error) {
        if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE') throw error;
      }
    }
    row = db.prepare('SELECT * FROM referral_codes WHERE player_id = ?').get(player.id);
  }

  return {
    ok: true,
    message: [
      '🎟️ *Código de convite DragonVerse*',
      '',
      `Seu código: *${row.code}*`,
      '',
      'Novos players com até 5 horas de registro podem usar:',
      `*/convite usar ${row.code}*`,
    ].join('\n'),
  };
}

function useInviteCode(message, argsText = '') {
  const recruit = getOrCreatePlayerFromMessage(message, { touch: true });
  const code = String(argsText || '').trim().split(/\s+/).pop()?.toUpperCase();

  if (!code || code === 'USAR') {
    return { ok: false, message: 'Use assim: */convite usar CODIGO*' };
  }

  if (hoursSince(recruit.created_at) > RECRUIT_WINDOW_HOURS) {
    return { ok: false, message: `Você só pode usar convite até *${RECRUIT_WINDOW_HOURS} horas* depois do registro da conta.` };
  }

  const existing = db.prepare('SELECT * FROM player_referrals WHERE recruit_id = ?').get(recruit.id);
  if (existing) return { ok: false, message: 'Você já usou um código de convite.' };

  const invite = db.prepare(`
    SELECT rc.*, p.whatsapp_id, p.phone, p.created_at AS recruiter_created_at
    FROM referral_codes rc
    JOIN players p ON p.id = rc.player_id
    WHERE UPPER(rc.code) = ?
  `).get(code);

  if (!invite) return { ok: false, message: 'Código de convite não encontrado.' };
  if (invite.player_id === recruit.id) return { ok: false, message: 'Você não pode usar seu próprio código.' };
  if (hoursSince(invite.recruiter_created_at) < RECRUITER_MIN_AGE_HOURS) {
    return { ok: false, message: `O dono do código precisa ter mais de *${RECRUITER_MIN_AGE_HOURS} horas* de registro.` };
  }

  const expires = new Date(Date.now() + REFERRAL_BONUS_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO player_referrals (recruit_id, recruiter_id, code, bonus_expires_at)
      VALUES (?, ?, ?, ?)
    `).run(recruit.id, invite.player_id, invite.code, expires);

    grantZenies(recruit.id, INVITE_INITIAL_REWARD, 'convite_inicial', { skipReferral: true });
    grantZenies(invite.player_id, INVITE_INITIAL_REWARD, 'convite_recrutador', { skipReferral: true });
  })();

  const recruiter = db.prepare('SELECT * FROM players WHERE id = ?').get(invite.player_id);
  return {
    ok: true,
    message: [
      '✅ *Convite usado com sucesso!*',
      '',
      `Recruta: ${mentionPlayer(recruit)}`,
      `Recrutador: ${mentionPlayer(recruiter)}`,
      `🎁 Ambos ganharam *${money(INVITE_INITIAL_REWARD)} Zenies*.`,
      '',
      `Durante 14 dias, o recrutador recebe *10%* dos ganhos do recruta, sem descontar nada do novato.`,
    ].join('\n'),
    mentions: mentionIds(recruit, recruiter),
  };
}

function inviteStatus(message) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const code = db.prepare('SELECT * FROM referral_codes WHERE player_id = ?').get(player.id);
  const recruited = db.prepare(`
    SELECT pr.*, p.phone, p.whatsapp_id
    FROM player_referrals pr
    JOIN players p ON p.id = pr.recruit_id
    WHERE pr.recruiter_id = ?
    ORDER BY pr.created_at DESC
  `).all(player.id);
  const myReferral = db.prepare(`
    SELECT pr.*, p.phone, p.whatsapp_id
    FROM player_referrals pr
    JOIN players p ON p.id = pr.recruiter_id
    WHERE pr.recruit_id = ?
  `).get(player.id);

  return {
    ok: true,
    message: [
      '🎟️ *Convites DragonVerse*',
      '',
      `Seu código: *${code?.code || 'use /convite gerar'}*`,
      myReferral ? `Você foi recrutado por: ${mentionPlayer(myReferral)}` : 'Você ainda não usou código de convite.',
      '',
      `Recrutas: *${recruited.length}*`,
      ...recruited.slice(0, 10).map((item) => `• ${mentionPlayer(item)} — bônus pago: ${money(item.total_bonus_paid)} Zenies`),
    ].join('\n'),
    mentions: mentionIds(...recruited, myReferral).filter(Boolean),
  };
}

function convite(message, argsText = '') {
  const action = String(argsText || '').trim().split(/\s+/)[0]?.toLowerCase();
  if (!action || ['status', 'info'].includes(action)) return inviteStatus(message);
  if (['gerar', 'codigo', 'código', 'meucodigo', 'meu'].includes(action)) return getInviteCode(message);
  if (['usar', 'resgatar'].includes(action)) return useInviteCode(message, argsText);
  return { ok: false, message: 'Use: */convite gerar*, */convite usar CODIGO* ou */convite status*.' };
}

module.exports = {
  convite,
  getInviteCode,
  useInviteCode,
};
