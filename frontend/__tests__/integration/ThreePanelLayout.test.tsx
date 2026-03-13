/**
 * Integration tests for Three-Panel Layout
 * Tests layout responsiveness, streaming, and workflows
 * Validates: Requirements 16.1, 16.2, 16.3
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThreePanelLayout } from '@/components/layout/ThreePanelLayout';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('ThreePanelLayout Integration Tests', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
    localStorage.clear();
  });

  describe('Layout Structure', () => {
    it('should render all three panels on load', () => {
      render(<ThreePanelLayout />);
      
      expect(screen.getByText('Query Input')).toBeInTheDocument();
      expect(screen.getByText('Analysis Results')).toBeInTheDocument();
      expect(screen.getByText('Details & Sources')).toBeInTheDocument();
    });

    it('should maintain responsive layout structure', () => {
      const { container } = render(<ThreePanelLayout />);
      
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toHaveClass('grid-cols-1', 'lg:grid-cols-12');
    });
  });

  describe('Query Submission Workflow', () => {
    it('should submit query and initiate streaming', async () => {
      // Mock session creation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session-123' })
      });

      // Mock query submission
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      render(<ThreePanelLayout />);

      // Wait for session initialization
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/session/create',
          expect.any(Object)
        );
      });

      // Find and fill query input
      const textarea = screen.getByPlaceholderText(/What changed in our roster processing/i);
      fireEvent.change(textarea, { target: { value: 'Test query' } });

      // Submit query
      const submitButton = screen.getByText('Analyze');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/query',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test query')
          })
        );
      });
    });

    it('should display processing state during query execution', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessionId: 'test-session-123' })
      });

      render(<ThreePanelLayout />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const textarea = screen.getByPlaceholderText(/What changed in our roster processing/i);
      fireEvent.change(textarea, { target: { value: 'Test query' } });

      const submitButton = screen.getByText('Analyze');
      fireEvent.click(submitButton);

      // Should show processing state
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  describe('Query Templates', () => {
    it('should populate query from template click', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessionId: 'test-session-123' })
      });

      render(<ThreePanelLayout />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Click on a diagnostic procedure template
      const triageButton = screen.getByText('Triage Stuck Files');
      fireEvent.click(triageButton);

      // Query should be populated
      const textarea = screen.getByPlaceholderText(/What changed in our roster processing/i) as HTMLTextAreaElement;
      expect(textarea.value).toContain('triage_stuck_ros');
    });
  });

  describe('Query History', () => {
    it('should save and display query history', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessionId: 'test-session-123' })
      });

      render(<ThreePanelLayout />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const textarea = screen.getByPlaceholderText(/What changed in our roster processing/i);
      fireEvent.change(textarea, { target: { value: 'Historical query' } });

      const submitButton = screen.getByText('Analyze');
      fireEvent.click(submitButton);

      // Check localStorage was updated
      await waitFor(() => {
        const history = JSON.parse(localStorage.getItem('queryHistory') || '[]');
        expect(history).toContain('Historical query');
      });
    });
  });

  describe('Results Display', () => {
    it('should show empty state when no results', () => {
      render(<ThreePanelLayout />);
      
      expect(screen.getByText('Submit a query to see analysis results')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle session creation failure gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(<ThreePanelLayout />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to initialize session:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    it('should handle query submission failure', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sessionId: 'test-session-123' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<ThreePanelLayout />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const textarea = screen.getByPlaceholderText(/What changed in our roster processing/i);
      fireEvent.change(textarea, { target: { value: 'Test query' } });

      const submitButton = screen.getByText('Analyze');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to submit query:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });
});
