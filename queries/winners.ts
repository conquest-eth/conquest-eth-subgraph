import 'dotenv/config';
import {TheGraph} from '../utils/thegraph';
import {BigNumber} from '@ethersproject/bignumber';

const theGraph = new TheGraph(`https://api.thegraph.com/subgraphs/name/${process.env.SUBGRAPH_NAME}`);

// query($blockNumber: Int! $first: Int! $lastId: ID! $id: ID!) {
const queryString = `
query($first: Int! $lastId: ID!) {
    owners(first: $first where: {
      totalStaked_gt: 0
      id_gt: $lastId
    }) {
      id
      currentStake
      playTokenToWithdraw
      playTokenBalance
      playTokenGiven
    }
}
`;

const DECIMALS_18 = BigNumber.from('1000000000000000000');

async function main() {
  const players: {
    id: string;
    currentStake: string;
    playTokenToWithdraw: string;
    playTokenBalance: string;
    playTokenGiven: string;
  }[] = await theGraph.query(queryString, 'owners', {});
  const winners = players
    .map((p) => {
      const currentStake = BigNumber.from(p.currentStake);
      const playTokenToWithdraw = BigNumber.from(p.playTokenToWithdraw);
      const playTokenBalance = BigNumber.from(p.playTokenBalance);
      const playTokenGiven = BigNumber.from(p.playTokenGiven);
      const total = currentStake.add(playTokenToWithdraw).add(playTokenBalance);
      return {
        id: p.id,
        total: total.div(DECIMALS_18).toNumber(),
        score: total.sub(playTokenGiven).mul(1000000).div(playTokenGiven).toNumber(),
        currentStake: currentStake.div(DECIMALS_18).toNumber(),
        playTokenToWithdraw: playTokenToWithdraw.div(DECIMALS_18).toNumber(),
        playTokenBalance: playTokenBalance.div(DECIMALS_18).toNumber(),
        playTokenGiven: playTokenGiven.div(DECIMALS_18).toNumber(),
      };
    })
    .sort((a, b) => b.score - a.score);

  console.log(winners.slice(0, 18));
}

main();
