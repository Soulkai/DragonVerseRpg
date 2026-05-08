
// PATCH GUIDE
// adicionar:
// const { isMuted, isBlocked } = require('./services/commandControl');
// const { shouldBlockRank } = require('./services/rankScheduler');
//
// antes de executar comandos:
// if(isMuted(user)) return;
// if(isBlocked(chat, command)) return;
//
// rankeada:
// if(shouldBlockRank()) block /desafio
