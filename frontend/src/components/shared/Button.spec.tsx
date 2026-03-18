import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';

describe('Button', () => {
  it('should render with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} disabled>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should render with primary variant by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByText('Primary');
    expect(button).toHaveClass('bg-blue-600');
  });

  it('should render with secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByText('Secondary');
    expect(button).toHaveClass('bg-gray-600');
  });

  it('should render with danger variant', () => {
    render(<Button variant="danger">Danger</Button>);
    const button = screen.getByText('Danger');
    expect(button).toHaveClass('bg-red-600');
  });

  it('should render with success variant', () => {
    render(<Button variant="success">Success</Button>);
    const button = screen.getByText('Success');
    expect(button).toHaveClass('bg-green-600');
  });

  it('should apply size classes for sm', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByText('Small');
    expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm');
  });

  it('should apply size classes for lg', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByText('Large');
    expect(button).toHaveClass('px-6', 'py-3', 'text-lg');
  });

  it('should apply custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByText('Custom');
    expect(button).toHaveClass('custom-class');
  });

  it('should have disabled styling when disabled', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByText('Disabled');
    expect(button).toBeDisabled();
  });
});
