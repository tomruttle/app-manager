// @flow

import React, { Component } from 'react';
import styled from 'styled-components';

const Button = styled.a`
  border: 0;
  padding: 1em;
  box-shadow: 1px 1px #ddd;
  font-weight: bold;
  font-size: 0.8em;
`;

const TextDiv = styled.div`
  color: ${({ colour }) => colour || 'Maroon'};
`;

type GuestReactProps = {
  colour: ?string,
  children?: (updateColourCallback: (colour: string) => void) => void,
};

type GuestReactState = {
  colour: ?string,
};

export default class GuestReact extends Component<GuestReactProps, GuestReactState> {
  state = {
    colour: this.props.colour,
  }

  componentDidMount = () => {
    const { children } = this.props;

    if (typeof children === 'function') {
      children(this.updateColour);
    }
  }

  updateColour = (colour: string) => {
    this.setState(() => ({ colour }));
  }

  handleClick = (e: SyntheticEvent<*>) => {
    window.history.pushState({}, null, e.currentTarget.pathname);
    e.preventDefault();
  };

  render = () => {
    const { colour } = this.state;

    const links = [<Button key="guest" onClick={this.handleClick} href="/apps/guest-template-string">Go to Guest Template String</Button>];

    if (colour !== 'blue') {
      links.push(<Button key="blue" onClick={this.handleClick} href="/apps/guest-react/blue">Make text blue</Button>);
    }

    if (colour !== 'green') {
      links.push(<Button key="green" onClick={this.handleClick} href="/apps/guest-react/green">Make text green</Button>);
    }

    if (colour) {
      links.push(<Button key="default" onClick={this.handleClick} href="/apps/guest-react">Default text colour</Button>);
    }

    return (
      <div>
        <h3>Guest React</h3>

        <TextDiv colour={colour}>
          <blockquote><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus magna. Cras in mi at felis aliquet congue. Ut a est eget ligula molestie gravida. Curabitur massa. Donec eleifend, libero at sagittis mollis, tellus est malesuada tellus, at luctus turpis elit sit amet quam. Vivamus pretium ornare est.</p></blockquote>

          <ul>
            <li>Lorem ipsum dolor sit amet, consectetuer adipiscing elit.</li>
            <li>Aliquam tincidunt mauris eu risus.</li>
          </ul>

          <ol>
            <li>Lorem ipsum dolor sit amet, consectetuer adipiscing elit.</li>
            <li>Aliquam tincidunt mauris eu risus.</li>
          </ol>

          <p><strong>Pellentesque habitant morbi tristique</strong> senectus et netus et malesuada fames ac turpis egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante. Donec eu libero sit amet quam egestas semper. <em>Aenean ultricies mi vitae est.</em> Mauris placerat eleifend leo. Quisque sit amet est et sapien ullamcorper pharetra. Vestibulum erat wisi, condimentum sed, <code>commodo vitae</code>, ornare sit amet, wisi. Aenean fermentum, elit eget tincidunt condimentum, eros ipsum rutrum orci, sagittis tempus lacus enim ac dui. Donec non enim in turpis pulvinar facilisis. Ut felis.</p>
        </TextDiv>

        {links}
      </div>
    );
  };
}
