// @flow

import React, { Component } from 'react';
import styled from 'styled-components';

export type EventType = {
  id: string,
  data: string,
}

type FooterAppProps = {
  children?: (updateEvents: (event: EventType) => void) => void,
};

type FooterAppState = {
  events: Array<EventType>,
};

const Footer = styled.div`
  margin-top: 4em;
`;

const ScrollableMenu = styled.div`
  height: 10em;

  li {
    color: grey;
    font-size: 0.8em;

    pre {
      display: inline-block;
      margin: 0;
    }
  }
`;

export default class FooterApp extends Component<FooterAppProps, FooterAppState> {
  state = {
    events: [],
  };

  componentDidMount = () => {
    const { children } = this.props;

    if (typeof children === 'function') {
      children(this.updateEvents);
    }
  }

  updateEvents = (event: EventType) => {
    this.setState((prevState) => ({ events: [event, ...prevState.events] }));
  }

  render = () => (
    <Footer>
      <h3>Events</h3>

      <ScrollableMenu className="pure-menu pure-menu-scrollable">
        <ul className="pure-menu-list">

          {this.state.events.map((event: EventType, index: number) => (
            <li className="pure-menu-item" key={event.id}>
              {this.state.events.length - index}. <pre>{event.data}</pre>
            </li>
          ))}

        </ul>
      </ScrollableMenu>
    </Footer>
  );
}
