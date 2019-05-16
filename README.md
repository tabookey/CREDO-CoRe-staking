# CoRe: Contributor Rewarding Staking Library
This library implements a crypto-economically secure technique for rewarding contributors of an open source project **without doing an ICO**. 

It’s compatible with any project that uses staking to incentivize participants to provide a service (e.g., run reliable oracle) while holding them accountable. It’s a just-for-fun MVP of [CREDO](https://github.com/tabookey/credo), a decentralized “equity” mechanism. 

If you’re hacking on a project that uses staking, integrating with this library creates 100 **CoRe** (**Co**ntributor **Re**ward) tokens for your project you can give as a reward to contributors (e.g., devs, designers, technical writers, QA, coffee & snack patrons)

**Staking Mechanism**
Our library includes two parallel mechanisms for minting a staking coin (c-DAI) that can be used to stake within your project:
1. Staking with DAI (1 DAI = 1 c-DAI)
2. Staking with up to 100 CoRe tokens that this library will create for your project. (1 CoRe token = 0.1% of staked DAI)

## Option 1: Regular Staking with DAI
Enables regular participants to lock their DAI in order to receive a staking token that will entitle them to be paid to perform a service for your project (e.g., serve as an oracle, etc.). 


![Regular Staking with DAI](/images/1.png?raw=true )

The flow is outlined as follows:
1. Any participant can lock their DAI within the Staking Coin Smart Contract in order to receive your Project Staking Coin. It’s represented as c-DAI.

2. The participant can then stake the Project Staking Coin in your project’s smart contract in order to get paid to perform a service such as serving as an oracle. 

3. The participant can unlock their DAI by sending the staking coin back to the Staking Coin contract.

## Option 2: Staking with **CoRe** (**Co**ntributor **Re**ward Token)
100 CoRe tokens (ERC20) are created for your project and they can be given to reward your project’s contributors (e.g., devs, designers, technical writers). 

1 CoRe token can be staked to mint c-DAI worth 0.1% of the total DAI staked in your project.

The flow:

![Staking with CoRe](/images/2.png?raw=true )

1. Project leader instantiates staking contract, receives 100 CoRe tokens to reward contributors who helped crush it during the Hackathon.


2. Contributors stake CoRe tokens within the Staking Coin Smart Contract in order to receive the project’s staking coin (represented as c-DAI). 

⋅⋅⋅Total c-DAI backed by 100 CoRe tokens is 10% of total DAI staked⋅⋅⋅



3. The contributors stake their c-DAI like regular participants, and get paid to perform a service (e.g., running an oracle)


4. The contributors return their c-DAI in order to unlock their CoRe tokens. 



