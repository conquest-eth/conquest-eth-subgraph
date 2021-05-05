import 'dotenv/config';
import {TheGraph} from '../utils/thegraph';
import * as fs from 'fs';
import {BigNumber} from '@ethersproject/bignumber';

const theGraph = new TheGraph(`https://api.thegraph.com/subgraphs/name/${process.env.SUBGRAPH_NAME}`);

const list = JSON.parse(fs.readFileSync('../../etherplay-email/db_alpha_1.json').toString());
const emails: {[introducer: string]: string} = {};
for (const elem of list) {
  if (elem.claimKey) {
    emails[elem.claimKey.address.toLowerCase()] = elem.email;
  }
}

// query($blockNumber: Int! $first: Int! $lastId: ID! $id: ID!) {
const queryString = `
query($first: Int! $lastId: ID!) {
    owners(first: $first where: {
      totalStaked_gt: 0
      id_gt: $lastId
    }) {
      id
      introducer { id }
      playTokenGiven
    }
}
`;

async function main() {
  const players: {
    id: string;
    introducer: {id: string};
    playTokenGiven: string;
  }[] = await theGraph.query(queryString, 'owners', {});

  const playersToEmail: {email: string; amount: number}[] = [];
  const airdrop: {address: string; amount: number}[] = [];
  for (const player of players) {
    const email = emails[player.introducer.id.toLowerCase()];
    const amount = BigNumber.from(player.playTokenGiven).div('1000000000000000000').toNumber();
    if (email) {
      playersToEmail.push({
        email,
        amount,
      });
    }
    airdrop.push({address: player.id, amount});
  }

  fs.writeFileSync('../airdrop.json', JSON.stringify(airdrop, null, 2));
  fs.writeFileSync('../playersToEmail.json', JSON.stringify(playersToEmail, null, 2));
}

main();
