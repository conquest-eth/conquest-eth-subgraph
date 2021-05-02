import 'dotenv/config';
import {TheGraph} from '../utils/thegraph';

const theGraph = new TheGraph(`https://api.thegraph.com/subgraphs/name/${process.env.SUBGRAPH_NAME}`);

// query($blockNumber: Int! $first: Int! $lastId: ID! $id: ID!) {
const queryString = `
query($first: Int! $lastId: ID!) {
    owners(first: $first where: {
      totalStaked_gt: 0
      id_gt: $lastId
    }) {
      id
    }
}
`;

async function main() {
  const players: {
    id: string;
  }[] = await theGraph.query(queryString, 'owners', {});
  console.log({players: players, numPlayers: players.length});
}

main();
